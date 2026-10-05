import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  attempts,
  sessionTasks,
  sessions,
  tasks,
  type Attempt,
  type Evaluation,
  type LearnState,
  type PracticeState,
  type Session,
  type SessionTask,
  type Subject,
  type Task,
  type TaskType,
} from "../db/schema";
import { PROMPT_VERSION, type SubjectContext } from "../ai/prompts";
import { evaluateAnswer, explainMisconception, generateTasks, type TaskPurpose } from "../ai/tasks";
import { env } from "../env";
import { DIAGNOSE_LEVELS, nextLevel, type Verdict } from "../domain/adaptive";
import { clamp01 } from "../domain/mastery";
import { getSubject, topicPath, topicSubtreeIds } from "./subjects";
import { findSnippets, resolveRefs } from "./retrieval";
import { topicMastery } from "./progress";

/**
 * Ablaufsteuerung für Lern- und Übungssitzungen.
 *
 * Wichtig: Lösungen und noch nicht freigegebene Hinweise verlassen diesen
 * Server nie vorzeitig. Die Freigaberegeln stehen hier im Code, nicht im Prompt.
 */

export class SessionError extends Error {}

const MAX_HINTS = 2;
/** Nach so vielen Versuchen darf die Lösung auch ohne alle Hinweise angezeigt werden. */
const ATTEMPTS_BEFORE_SOLUTION = 3;

function subjectCtx(s: Subject): SubjectContext {
  return { name: s.name, profile: s.profile, level: s.level };
}

function requireSubject(id: string): Subject {
  const s = getSubject(id);
  if (!s) throw new SessionError("Fach nicht gefunden");
  return s;
}

/** Erzeugt Aufgaben per KI und speichert sie (inkl. Quellen) in der Sitzung. */
async function createTasksForSession(opts: {
  session: Session;
  subject: Subject;
  purpose: TaskPurpose;
  count: number;
  difficulty: number | number[];
  type: TaskType | "mixed";
  focus: string | null;
  misconception: string | null;
  startPosition: number;
}) {
  const path = topicPath(opts.session.topicId);
  const snippets = findSnippets({
    subjectId: opts.subject.id,
    topicIds: opts.session.topicId ? topicSubtreeIds(opts.subject.id, opts.session.topicId) : null,
    query: [opts.subject.name, ...path, opts.focus ?? "", opts.misconception ?? ""].join(" "),
  });

  const db = getDb();
  const previous = db
    .select({ prompt: tasks.promptMd })
    .from(sessionTasks)
    .innerJoin(tasks, eq(tasks.id, sessionTasks.taskId))
    .where(eq(sessionTasks.sessionId, opts.session.id))
    .all()
    .map((r) => r.prompt);

  const generated = await generateTasks({
    subject: subjectCtx(opts.subject),
    topicPath: path,
    purpose: opts.purpose,
    count: opts.count,
    difficulty: opts.difficulty,
    type: opts.type,
    focus: opts.focus,
    misconception: opts.misconception,
    avoidPrompts: previous,
    snippets,
  });
  if (generated.length === 0) throw new SessionError("Die KI hat keine Aufgaben erzeugt.");

  const generator = `ai:${env.ai.provider}/${opts.purpose === "practice" ? env.ai.modelStrong : env.ai.modelFast}@${PROMPT_VERSION}`;
  db.transaction((tx) => {
    generated.forEach((g, i) => {
      const rubric = g.rubric.filter((r) => r.criterion.trim());
      const rubricSum = rubric.reduce((s, r) => s + Math.max(0, r.points), 0);
      const maxPoints = Math.max(1, Math.round(g.max_points || rubricSum || 1));
      const task = tx
        .insert(tasks)
        .values({
          subjectId: opts.subject.id,
          topicId: opts.session.topicId,
          type: g.type,
          difficulty: Math.min(5, Math.max(1, Math.round(g.difficulty))),
          promptMd: g.prompt_md,
          maxPoints,
          solutionMd: g.solution_md,
          rubric: rubric.length ? rubric : [{ criterion: "Vollständig richtig", points: maxPoints }],
          hints: g.hints.filter((h) => h.trim()).slice(0, MAX_HINTS),
          concept: g.concept || null,
          sources: resolveRefs(g.source_refs, snippets),
          basis: g.basis,
          generator,
        })
        .returning()
        .get();
      tx.insert(sessionTasks)
        .values({
          sessionId: opts.session.id,
          taskId: task.id,
          position: opts.startPosition + i,
          purpose: opts.purpose,
        })
        .run();
    });
  });
}

export async function startLearnSession(input: {
  subjectId: string;
  topicId: string | null;
  focus: string | null;
}): Promise<string> {
  const subject = requireSubject(input.subjectId);
  // Schon geübtes Thema: Diagnose überspringen, Niveau aus Beherrschung ableiten.
  const known = topicMastery(subject.id, input.topicId);
  const skipDiagnose = known !== null && known.confidence >= 0.5;
  const state: LearnState = skipDiagnose
    ? { phase: "learn", level: Math.min(5, Math.max(1, Math.round(1 + known.mastery * 4))), focus: input.focus }
    : { phase: "diagnose", level: 2, focus: input.focus };

  const session = getDb()
    .insert(sessions)
    .values({ mode: "learn", subjectId: subject.id, topicId: input.topicId, state })
    .returning()
    .get();

  try {
    await createTasksForSession({
      session,
      subject,
      purpose: skipDiagnose ? "learn" : "diagnose",
      count: skipDiagnose ? 1 : DIAGNOSE_LEVELS.length,
      difficulty: skipDiagnose ? state.level : [...DIAGNOSE_LEVELS],
      type: "short",
      focus: input.focus,
      misconception: null,
      startPosition: 0,
    });
  } catch (err) {
    getDb().delete(sessions).where(eq(sessions.id, session.id)).run();
    throw err;
  }
  return session.id;
}

export async function startPracticeSession(input: {
  subjectId: string;
  topicId: string | null;
  difficulty: number;
  type: TaskType | "mixed";
  count: number;
  timeLimitMin: number | null;
  focus: string | null;
}): Promise<string> {
  const subject = requireSubject(input.subjectId);
  const state: PracticeState = {
    difficulty: input.difficulty,
    type: input.type,
    count: input.count,
    timeLimitMin: input.timeLimitMin,
    focus: input.focus,
  };
  const session = getDb()
    .insert(sessions)
    .values({ mode: "practice", subjectId: subject.id, topicId: input.topicId, state })
    .returning()
    .get();
  try {
    await createTasksForSession({
      session,
      subject,
      purpose: "practice",
      count: input.count,
      difficulty: input.difficulty,
      type: input.type,
      focus: input.focus,
      misconception: null,
      startPosition: 0,
    });
  } catch (err) {
    getDb().delete(sessions).where(eq(sessions.id, session.id)).run();
    throw err;
  }
  return session.id;
}

// ---------------------------------------------------------------------------
// Ansicht (was der Client sehen darf)
// ---------------------------------------------------------------------------

export type AttemptView = {
  answer: string;
  score: number;
  maxScore: number;
  confidence: number;
  evaluation: Evaluation;
};

export type SessionTaskView = {
  id: string;
  position: number;
  purpose: SessionTask["purpose"];
  status: SessionTask["status"];
  prompt: string;
  type: TaskType;
  difficulty: number;
  maxPoints: number;
  concept: string | null;
  basis: Task["basis"];
  sources: Task["sources"];
  hints: string[];
  hintsTotal: number;
  attempts: AttemptView[];
  canHint: boolean;
  canRevealSolution: boolean;
  canFinish: boolean;
  /** Nur gesetzt, wenn freigegeben. */
  solution: string | null;
  explanation: string | null;
};

function canReveal(st: SessionTask, task: Task, attemptCount: number) {
  return (
    st.status === "open" &&
    attemptCount > 0 &&
    (st.hintsRevealed >= task.hints.length || attemptCount >= ATTEMPTS_BEFORE_SOLUTION)
  );
}

function toView(st: SessionTask, task: Task, list: Attempt[], mode: Session["mode"]): SessionTaskView {
  const solutionVisible = st.solutionRevealed || st.status === "done";
  return {
    id: st.id,
    position: st.position,
    purpose: st.purpose,
    status: st.status,
    prompt: task.promptMd,
    type: task.type,
    difficulty: task.difficulty,
    maxPoints: task.maxPoints,
    concept: task.concept,
    basis: task.basis,
    sources: task.sources,
    hints: task.hints.slice(0, st.hintsRevealed),
    hintsTotal: task.hints.length,
    attempts: list.map((a) => ({
      answer: a.answerMd,
      score: a.score,
      maxScore: a.maxScore,
      confidence: a.confidence,
      evaluation: a.evaluation,
    })),
    canHint: st.status === "open" && list.length > 0 && st.hintsRevealed < task.hints.length,
    canRevealSolution: canReveal(st, task, list.length),
    canFinish:
      st.status === "open" && list.length > 0 && (mode === "practice" || st.purpose === "diagnose"),
    solution: solutionVisible ? task.solutionMd : null,
    explanation: st.explanationMd,
  };
}

export function getSessionView(sessionId: string) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return null;
  const subject = requireSubject(session.subjectId);
  const rows = db
    .select()
    .from(sessionTasks)
    .innerJoin(tasks, eq(tasks.id, sessionTasks.taskId))
    .where(eq(sessionTasks.sessionId, sessionId))
    .orderBy(asc(sessionTasks.position))
    .all();
  const stIds = rows.map((r) => r.session_tasks.id);
  const allAttempts = stIds.length
    ? db
        .select()
        .from(attempts)
        .where(inArray(attempts.sessionTaskId, stIds))
        .orderBy(asc(attempts.createdAt))
        .all()
    : [];
  const items = rows.map((r) =>
    toView(
      r.session_tasks,
      r.tasks,
      allAttempts.filter((a) => a.sessionTaskId === r.session_tasks.id),
      session.mode,
    ),
  );
  const current = items.find((i) => i.status === "open") ?? null;
  return { session, subject, topicPath: topicPath(session.topicId), items, current };
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

function loadSessionTask(sessionTaskId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(sessionTasks)
    .innerJoin(tasks, eq(tasks.id, sessionTasks.taskId))
    .innerJoin(sessions, eq(sessions.id, sessionTasks.sessionId))
    .where(eq(sessionTasks.id, sessionTaskId))
    .get();
  if (!row) throw new SessionError("Aufgabe nicht gefunden");
  if (row.sessions.endedAt) throw new SessionError("Diese Sitzung ist beendet.");
  const list = db
    .select()
    .from(attempts)
    .where(eq(attempts.sessionTaskId, sessionTaskId))
    .orderBy(asc(attempts.createdAt))
    .all();
  return { st: row.session_tasks, task: row.tasks, session: row.sessions, attempts: list };
}

export async function submitAnswer(input: {
  sessionTaskId: string;
  answer: string;
  durationS: number;
  giveUp: boolean;
}) {
  const { st, task, session } = loadSessionTask(input.sessionTaskId);
  if (st.status !== "open" || st.solutionRevealed) {
    throw new SessionError("Diese Aufgabe ist bereits abgeschlossen.");
  }
  const answer = input.answer.trim();
  const subject = requireSubject(task.subjectId);

  let evaluation: Evaluation;
  let score = 0;
  let confidence = 1;
  if (input.giveUp || !answer) {
    // "Weiß ich nicht" – ehrlich, kostet keinen KI-Aufruf.
    evaluation = {
      verdict: "incorrect",
      feedbackMd: "Kein Problem – mit einem Hinweis klappt es vielleicht.",
      errors: [],
      clarifyingQuestion: null,
      dimensions: [],
    };
  } else {
    const out = await evaluateAnswer({
      subject: subjectCtx(subject),
      topicPath: topicPath(task.topicId),
      taskPrompt: task.promptMd,
      solution: task.solutionMd,
      rubric: task.rubric,
      maxPoints: task.maxPoints,
      answer,
      hintsUsed: st.hintsRevealed,
      strong: session.mode === "practice",
    });
    score = Math.min(task.maxPoints, Math.max(0, out.score));
    confidence = clamp01(out.confidence);
    evaluation = {
      verdict: out.verdict,
      feedbackMd: out.feedback_md,
      errors: out.errors,
      clarifyingQuestion: out.clarifying_question,
      dimensions: out.dimensions.map((d) => ({ ...d, score: clamp01(d.score) })),
    };
    // Unsichere "richtig"-Urteile nicht als richtig durchwinken.
    if (evaluation.verdict === "correct" && confidence < 0.5) evaluation.verdict = "unclear";
  }

  const db = getDb();
  db.transaction((tx) => {
    tx.insert(attempts)
      .values({
        taskId: task.id,
        sessionTaskId: st.id,
        answerMd: answer,
        hintsUsed: st.hintsRevealed,
        score,
        maxScore: task.maxPoints,
        evaluation,
        confidence,
        durationS: Math.min(3600, Math.max(0, Math.round(input.durationS))),
      })
      .run();
    if (evaluation.verdict === "correct") {
      tx.update(sessionTasks).set({ status: "done" }).where(eq(sessionTasks.id, st.id)).run();
      advanceLearnState(tx, session, "correct", st.hintsRevealed);
    }
  });
}

export function revealHint(sessionTaskId: string) {
  const { st, task, attempts: list } = loadSessionTask(sessionTaskId);
  if (st.status !== "open" || list.length === 0 || st.hintsRevealed >= task.hints.length) {
    throw new SessionError("Ein Hinweis ist erst nach einem eigenen Versuch verfügbar.");
  }
  getDb()
    .update(sessionTasks)
    .set({ hintsRevealed: st.hintsRevealed + 1 })
    .where(eq(sessionTasks.id, st.id))
    .run();
}

export async function revealSolution(sessionTaskId: string) {
  const { st, task, session, attempts: list } = loadSessionTask(sessionTaskId);
  if (!canReveal(st, task, list.length)) {
    throw new SessionError("Die Lösung gibt es erst nach eigenen Versuchen und den Hinweisen.");
  }
  const last = list[list.length - 1];

  let explanationMd: string | null = null;
  if (session.mode === "learn") {
    // Gezielte Erklärung zum Missverständnis – nicht die ganze Theorie.
    const subject = requireSubject(task.subjectId);
    const path = topicPath(task.topicId);
    try {
      const out = await explainMisconception({
        subject: subjectCtx(subject),
        topicPath: path,
        taskPrompt: task.promptMd,
        solution: task.solutionMd,
        answer: last.answerMd,
        errors: last.evaluation.errors.map((e) => `${e.label}: ${e.description}`),
        snippets: findSnippets({
          subjectId: subject.id,
          topicIds: task.topicId ? topicSubtreeIds(subject.id, task.topicId) : null,
          query: [task.concept ?? "", ...path].join(" "),
          limit: 4,
        }),
      });
      const basisNote =
        out.basis === "material"
          ? "\n\n_Quelle: deine Materialien_"
          : out.basis === "mixed"
            ? "\n\n_Quelle: deine Materialien + Allgemeinwissen_"
            : "\n\n_Quelle: Allgemeinwissen_";
      const conflicts = out.conflicts.length
        ? `\n\n**Achtung, Widerspruch:** ${out.conflicts.join(" ")}`
        : "";
      explanationMd = out.explanation_md + basisNote + conflicts;
    } catch {
      explanationMd = null; // Lösung wird trotzdem gezeigt.
    }
  }

  const db = getDb();
  db.transaction((tx) => {
    tx.update(sessionTasks)
      .set({ solutionRevealed: true, status: "done", explanationMd })
      .where(eq(sessionTasks.id, st.id))
      .run();
    advanceLearnState(tx, session, last.evaluation.verdict === "partial" ? "partial" : "incorrect", st.hintsRevealed);
  });
}

/**
 * Aufgabe nach mindestens einem Versuch abschließen, ohne sie zu lösen.
 * Nur im Übungsmodus und für Diagnosefragen – im Lernmodus führt der Weg
 * über Hinweise zur Lösung.
 */
export function finishTask(sessionTaskId: string) {
  const { st, session, attempts: list } = loadSessionTask(sessionTaskId);
  if (st.status !== "open" || list.length === 0) {
    throw new SessionError("Erst einen eigenen Versuch abgeben.");
  }
  if (session.mode !== "practice" && st.purpose !== "diagnose") {
    throw new SessionError("Im Lernmodus geht es über Hinweise weiter.");
  }
  const verdict = list[list.length - 1].evaluation.verdict;
  getDb().transaction((tx) => {
    tx.update(sessionTasks).set({ status: "done" }).where(eq(sessionTasks.id, st.id)).run();
    advanceLearnState(tx, session, verdict, st.hintsRevealed);
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Passt im Lernmodus das Niveau nach jeder abgeschlossenen Aufgabe an. */
function advanceLearnState(tx: Tx, session: Session, verdict: Verdict, hintsUsed: number) {
  if (session.mode !== "learn") return;
  const state = session.state as LearnState;
  const next: LearnState = { ...state, level: nextLevel(state.level, verdict, hintsUsed) };
  tx.update(sessions).set({ state: next }).where(eq(sessions.id, session.id)).run();
}

/**
 * Lernmodus: nächste Frage erzeugen. Nach einer nicht gelösten Aufgabe folgt
 * eine Kontrollfrage zum selben Konzept, sonst eine neue Frage auf dem
 * angepassten Niveau.
 */
export async function nextLearnTask(sessionId: string) {
  const view = getSessionView(sessionId);
  if (!view || view.session.mode !== "learn") throw new SessionError("Sitzung nicht gefunden");
  if (view.session.endedAt) throw new SessionError("Diese Sitzung ist beendet.");
  if (view.current) return; // Es gibt noch eine offene Aufgabe.

  const db = getDb();
  let state = view.session.state as LearnState;
  if (state.phase === "diagnose") {
    state = { ...state, phase: "learn" };
    db.update(sessions).set({ state }).where(eq(sessions.id, sessionId)).run();
  }

  const last = view.items[view.items.length - 1];
  const lastVerdict = last?.attempts[last.attempts.length - 1]?.evaluation.verdict;
  const needsCheck = !!last && last.status === "done" && lastVerdict !== "correct";
  const misconception = needsCheck
    ? [
        last.concept,
        ...(last.attempts.at(-1)?.evaluation.errors.map((e) => e.label) ?? []),
      ]
        .filter(Boolean)
        .join("; ")
    : null;

  await createTasksForSession({
    session: { ...view.session, state },
    subject: view.subject,
    purpose: needsCheck ? "check" : "learn",
    count: 1,
    difficulty: state.level,
    type: "short",
    focus: state.focus,
    misconception,
    startPosition: view.items.length,
  });
}

export function endSession(sessionId: string) {
  getDb()
    .update(sessions)
    .set({ endedAt: new Date().toISOString() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)))
    .run();
}

export function recentSessions(limit = 5) {
  const db = getDb();
  return db.select().from(sessions).orderBy(desc(sessions.startedAt)).limit(limit).all();
}

export function listSessions(mode: "learn" | "practice", limit = 10) {
  return getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.mode, mode))
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .all();
}
