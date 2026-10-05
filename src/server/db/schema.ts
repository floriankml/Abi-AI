import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/**
 * Datenmodell von AbiOS. Siehe docs/ARCHITECTURE.md, Abschnitt 4.
 *
 * Konventionen:
 * - IDs sind UUIDs (stabil bei Export/Import).
 * - Zeitstempel sind ISO-8601-Strings in UTC.
 * - JSON-Felder sind als Text gespeichert und in TypeScript typisiert.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const SUBJECT_PROFILES = ["stem", "language", "humanities", "arts"] as const;
export type SubjectProfile = (typeof SUBJECT_PROFILES)[number];

export const subjects = sqliteTable("subjects", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#64748b"),
  profile: text("profile", { enum: SUBJECT_PROFILES }).notNull(),
  level: text("level", { enum: ["eA", "gA"] }),
  position: integer("position").notNull().default(0),
  archivedAt: text("archived_at"),
  createdAt: createdAt(),
});

export const topics = sqliteTable(
  "topics",
  {
    id: id(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => topics.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    /** Prüfungsrelevanz 0–3, für Priorisierung. */
    examWeight: integer("exam_weight").notNull().default(1),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("topics_subject_idx").on(t.subjectId)],
);

export const MATERIAL_KINDS = ["pdf", "docx", "pptx", "image", "text", "note"] as const;
export const MATERIAL_CATEGORIES = ["notes", "past_exam", "curriculum", "other"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const materials = sqliteTable(
  "materials",
  {
    id: id(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: MATERIAL_KINDS }).notNull(),
    /** notes = eigene Notizen, past_exam = alte Abituraufgaben, curriculum = Lehrplan */
    category: text("category", { enum: MATERIAL_CATEGORIES }).notNull().default("notes"),
    originalName: text("original_name").notNull(),
    /** Relativ zu DATA_DIR/files. Originaldatei bleibt unverändert. */
    filePath: text("file_path").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    extractionStatus: text("extraction_status", {
      enum: ["ok", "empty", "unsupported", "failed"],
    }).notNull(),
    extractionError: text("extraction_error"),
    createdAt: createdAt(),
  },
  (t) => [index("materials_subject_idx").on(t.subjectId)],
);

/** Extrahierter Text in Abschnitten. Volltextindex: material_chunks_fts (siehe Migration). */
export const materialChunks = sqliteTable(
  "material_chunks",
  {
    id: id(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    page: integer("page"),
    text: text("text").notNull(),
  },
  (t) => [index("chunks_material_idx").on(t.materialId)],
);

export const TASK_TYPES = ["short", "calc", "open", "essay"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type RubricItem = { criterion: string; points: number };
export type SourceRef = { materialId: string; chunkId: string; title: string; page: number | null };

export const tasks = sqliteTable("tasks", {
  id: id(),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
  type: text("type", { enum: TASK_TYPES }).notNull(),
  difficulty: integer("difficulty").notNull(),
  promptMd: text("prompt_md").notNull(),
  maxPoints: real("max_points").notNull(),
  /** Nur serverseitig! Wird erst nach Freigabe an den Client gegeben. */
  solutionMd: text("solution_md").notNull(),
  rubric: text("rubric", { mode: "json" }).$type<RubricItem[]>().notNull(),
  hints: text("hints", { mode: "json" }).$type<string[]>().notNull(),
  /** Das Konzept, das die Aufgabe prüft – Grundlage für Kontrollfragen. */
  concept: text("concept"),
  sources: text("sources", { mode: "json" }).$type<SourceRef[]>().notNull(),
  basis: text("basis", { enum: ["material", "general", "mixed"] }).notNull(),
  generator: text("generator").notNull(),
  createdAt: createdAt(),
});

export const SESSION_MODES = ["learn", "practice", "exam", "review"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export type LearnState = {
  /** Diagnosephase: die ersten Fragen bestimmen das Einstiegsniveau. */
  phase: "diagnose" | "learn";
  level: number;
  focus: string | null;
};
export type PracticeState = {
  difficulty: number;
  type: TaskType | "mixed";
  count: number;
  timeLimitMin: number | null;
  focus: string | null;
};

export const sessions = sqliteTable("sessions", {
  id: id(),
  mode: text("mode", { enum: SESSION_MODES }).notNull(),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
  state: text("state", { mode: "json" }).$type<LearnState | PracticeState>().notNull(),
  startedAt: createdAt(),
  endedAt: text("ended_at"),
});

/** Eine Aufgabe innerhalb einer Sitzung, inkl. Ablaufzustand (Hinweise, Lösung). */
export const sessionTasks = sqliteTable(
  "session_tasks",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    purpose: text("purpose", { enum: ["diagnose", "learn", "check", "practice"] }).notNull(),
    status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
    hintsRevealed: integer("hints_revealed").notNull().default(0),
    solutionRevealed: integer("solution_revealed", { mode: "boolean" }).notNull().default(false),
    /** Kurze Erklärung, die nach falscher Antwort erzeugt wurde (Lernmodus). */
    explanationMd: text("explanation_md"),
  },
  (t) => [index("session_tasks_session_idx").on(t.sessionId)],
);

export type EvaluationError = { label: string; category: string; description: string };
export type Evaluation = {
  verdict: "correct" | "partial" | "incorrect" | "unclear";
  feedbackMd: string;
  errors: EvaluationError[];
  clarifyingQuestion: string | null;
  dimensions: { name: string; score: number; comment: string }[];
};

export const attempts = sqliteTable(
  "attempts",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    sessionTaskId: text("session_task_id").references(() => sessionTasks.id, {
      onDelete: "set null",
    }),
    answerMd: text("answer_md").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
    score: real("score").notNull(),
    maxScore: real("max_score").notNull(),
    evaluation: text("evaluation", { mode: "json" }).$type<Evaluation>().notNull(),
    confidence: real("confidence").notNull(),
    durationS: integer("duration_s").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_task_idx").on(t.taskId), index("attempts_created_idx").on(t.createdAt)],
);

/** Token-Verbrauch der KI – ohne Inhalte (Datenschutz). */
export const aiUsage = sqliteTable("ai_usage", {
  id: id(),
  task: text("task").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  createdAt: createdAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export type Subject = typeof subjects.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionTask = typeof sessionTasks.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
