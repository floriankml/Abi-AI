"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE,
  checkPassword,
  isSetUp,
  loginBlocked,
  passwordFromEnv,
  requireAuth,
  setPassword,
  startSession,
} from "@/server/auth";
import { GEMINI_PRESET, aiConfigFromEnv, getAiConfig, runAi, type AiConfig } from "@/server/ai";
import { env } from "@/server/env";
import { setSetting } from "@/server/settings";
import { AiError, aiErrorMessage } from "@/server/ai/provider";
import { MATERIAL_CATEGORIES, SUBJECT_PROFILES, TASK_TYPES } from "@/server/db/schema";
import { MaterialError, addNote, deleteMaterial } from "@/server/services/materials";
import {
  SessionError,
  endSession,
  finishTask,
  nextLearnTask,
  revealHint,
  revealSolution,
  startLearnSession,
  startPracticeSession,
  submitAnswer,
} from "@/server/services/sessions";
import {
  archiveSubject,
  createSubject,
  createTopic,
  deleteTopic,
  updateSubject,
  updateTopic,
} from "@/server/services/subjects";

/**
 * Alle Server Actions. Jede Action ist ein öffentlicher Endpunkt: zuerst
 * Anmeldung prüfen, dann Eingaben mit Zod validieren.
 */

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function toMessage(err: unknown): string {
  if (err instanceof AiError) return aiErrorMessage(err);
  if (err instanceof SessionError || err instanceof MaterialError) return err.message;
  if (err instanceof z.ZodError) return "Bitte die Eingaben prüfen.";
  console.error(err);
  return "Etwas ist schiefgelaufen. Bitte erneut versuchen.";
}

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

// --- Anmeldung -------------------------------------------------------------

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (await loginBlocked()) return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };
  if (!(await checkPassword(String(formData.get("password") ?? "")))) return { error: "Falsches Passwort." };
  await startSession();
  redirect("/");
}

const newPassword = z
  .object({
    password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Die Passwörter stimmen nicht überein." });

const geminiKey = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || "");

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Bitte die Eingaben prüfen.";
}

/**
 * Ersteinrichtung im Browser: Passwort festlegen, optional KI-Schlüssel.
 * Nur möglich, solange noch kein Passwort existiert. In der Cloud zusätzlich
 * durch einen Einrichtungscode (SETUP_CODE) geschützt.
 */
export async function setupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (await isSetUp()) redirect("/login");
  if (env.setupCode) {
    const code = String(formData.get("setupCode") ?? "").trim();
    if (!safeEqual(code, env.setupCode)) {
      await loginBlocked(); // gleiche Bremse wie beim Login
      return { error: "Der Einrichtungscode stimmt nicht." };
    }
  }
  const pw = newPassword.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!pw.success) return { error: firstIssue(pw.error) };
  const key = geminiKey.parse(formData.get("geminiKey") ?? "");
  await setPassword(pw.data.password);
  if (key && !aiConfigFromEnv()) await setSetting("ai.config", { ...GEMINI_PRESET, apiKey: key });
  await startSession();
  redirect("/");
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  if (passwordFromEnv()) return { error: "Das Passwort ist über APP_PASSWORD festgelegt." };
  if (!(await checkPassword(String(formData.get("current") ?? "")))) {
    return { error: "Das aktuelle Passwort stimmt nicht." };
  }
  const pw = newPassword.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!pw.success) return { error: firstIssue(pw.error) };
  await setPassword(pw.data.password);
  await startSession(); // dieses Gerät bleibt angemeldet
  return { ok: true };
}

/** KI-Anbieter im Browser einrichten (Gemini-Voreinstellung oder eigener Endpunkt). */
export async function saveAiSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  if (aiConfigFromEnv()) return { error: "Die KI ist über Umgebungsvariablen festgelegt." };
  const input = z
    .object({
      preset: z.enum(["gemini", "custom", "anthropic", "none"]),
      apiKey: geminiKey,
      baseUrl: z.string().trim().max(300).optional().default(""),
      modelFast: z.string().trim().max(100).optional().default(""),
      modelStrong: z.string().trim().max(100).optional().default(""),
      modelFallbacks: z.string().trim().max(500).optional().default(""),
    })
    .parse(Object.fromEntries(formData));
  const previous = await getAiConfig();
  // Leeres Schlüsselfeld = bisherigen Schlüssel behalten.
  const apiKey = input.apiKey || previous.apiKey;
  const fallbacks = input.modelFallbacks
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  let config: AiConfig;
  switch (input.preset) {
    case "gemini":
      if (!apiKey) return { error: "Bitte den Gemini-Schlüssel eintragen." };
      config = {
        ...GEMINI_PRESET,
        ...(input.modelFast ? { modelFast: input.modelFast } : {}),
        ...(input.modelStrong ? { modelStrong: input.modelStrong } : {}),
        ...(fallbacks.length ? { modelFallbacks: fallbacks } : {}),
        apiKey,
      };
      break;
    case "anthropic":
      if (!apiKey || !input.modelFast) return { error: "Bitte Schlüssel und Modell eintragen." };
      config = { ...input, provider: "anthropic", apiKey, modelFallbacks: [], jsonMode: "json_object" };
      break;
    case "custom":
      if (!input.baseUrl || !input.modelFast) return { error: "Bitte Endpunkt und Modell eintragen." };
      config = { ...input, provider: "openai-compatible", apiKey, modelFallbacks: fallbacks, jsonMode: "json_object" };
      break;
    default:
      config = { ...previous, provider: "none" };
  }
  await setSetting("ai.config", config);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Kurzer Verbindungstest mit der gespeicherten KI-Konfiguration. */
export async function testAiAction(): Promise<ActionState> {
  await requireAuth();
  try {
    const { model } = await runAi({
      task: "test",
      tier: "fast",
      system: "Antworte knapp.",
      prompt: 'Antworte mit {"ok": true}.',
      schema: z.object({ ok: z.boolean() }),
    });
    return { ok: true, message: `Verbindung klappt (Modell: ${model}).` };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// --- Fächer & Themen ------------------------------------------------------

const subjectInput = z.object({
  name: z.string().trim().min(1).max(60),
  profile: z.enum(SUBJECT_PROFILES),
  level: z
    .enum(["eA", "gA", ""])
    .transform((v) => (v === "" ? null : v)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function createSubjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    await createSubject(subjectInput.parse(Object.fromEntries(formData)));
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSubjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const id = z.string().parse(formData.get("id"));
    await updateSubject(id, subjectInput.parse(Object.fromEntries(formData)));
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveSubjectAction(formData: FormData) {
  await requireAuth();
  await archiveSubject(z.string().parse(formData.get("id")));
  revalidatePath("/", "layout");
  redirect("/faecher");
}

export async function createTopicAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const input = z
      .object({
        subjectId: z.string(),
        parentId: optionalId,
        title: z.string().trim().min(1).max(120),
        examWeight: z.coerce.number().int().min(0).max(3),
      })
      .parse(Object.fromEntries(formData));
    await createTopic(input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/faecher");
  return { ok: true };
}

export async function updateTopicAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const input = z
      .object({
        id: z.string(),
        title: z.string().trim().min(1).max(120),
        examWeight: z.coerce.number().int().min(0).max(3),
      })
      .parse(Object.fromEntries(formData));
    await updateTopic(input.id, input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/faecher");
  return { ok: true };
}

export async function deleteTopicAction(formData: FormData) {
  await requireAuth();
  await deleteTopic(z.string().parse(formData.get("id")));
  revalidatePath("/faecher");
}

// --- Materialien -----------------------------------------------------------

export async function addNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const input = z
      .object({
        subjectId: z.string().min(1),
        topicId: optionalId,
        title: z.string().trim().min(1).max(200),
        text: z.string().trim().min(1).max(200_000),
        category: z.enum(MATERIAL_CATEGORIES),
      })
      .parse(Object.fromEntries(formData));
    await addNote(input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/materialien");
  return { ok: true };
}

export async function deleteMaterialAction(formData: FormData) {
  await requireAuth();
  await deleteMaterial(z.string().parse(formData.get("id")));
  revalidatePath("/materialien");
}

// --- Lernen & Üben ---------------------------------------------------------

export async function startLearnAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  let id: string;
  try {
    const input = z
      .object({ subjectId: z.string().min(1), topicId: optionalId, focus: optionalText })
      .parse(Object.fromEntries(formData));
    id = await startLearnSession(input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  redirect(`/lernen/${id}`);
}

export async function startPracticeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  let id: string;
  try {
    const input = z
      .object({
        subjectId: z.string().min(1),
        topicId: optionalId,
        difficulty: z.coerce.number().int().min(1).max(5),
        type: z.enum([...TASK_TYPES, "mixed"]),
        count: z.coerce.number().int().min(1).max(10),
        timeLimitMin: z
          .string()
          .optional()
          .transform((v) => (v ? Number(v) : null))
          .pipe(z.number().int().min(1).max(300).nullable()),
        focus: optionalText,
      })
      .parse(Object.fromEntries(formData));
    id = await startPracticeSession(input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  redirect(`/ueben/${id}`);
}

const sessionPath = (mode: "learn" | "practice", sessionId: string) =>
  mode === "learn" ? `/lernen/${sessionId}` : `/ueben/${sessionId}`;

type TaskRef = { sessionId: string; sessionTaskId: string; mode: "learn" | "practice" };

async function runTaskAction(ref: TaskRef, fn: () => unknown): Promise<ActionState> {
  await requireAuth();
  try {
    await fn();
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath(sessionPath(ref.mode, ref.sessionId));
  return { ok: true };
}

export async function submitAnswerAction(
  ref: TaskRef,
  input: { answer: string; durationS: number; giveUp: boolean },
): Promise<ActionState> {
  return runTaskAction(ref, () => {
    const parsed = z
      .object({ answer: z.string().max(50_000), durationS: z.number(), giveUp: z.boolean() })
      .parse(input);
    return submitAnswer({ sessionTaskId: ref.sessionTaskId, ...parsed });
  });
}

export async function hintAction(ref: TaskRef): Promise<ActionState> {
  return runTaskAction(ref, () => revealHint(ref.sessionTaskId));
}

export async function revealSolutionAction(ref: TaskRef): Promise<ActionState> {
  return runTaskAction(ref, () => revealSolution(ref.sessionTaskId));
}

export async function finishTaskAction(ref: TaskRef): Promise<ActionState> {
  return runTaskAction(ref, () => finishTask(ref.sessionTaskId));
}

export async function nextLearnTaskAction(sessionId: string): Promise<ActionState> {
  return runTaskAction({ sessionId, sessionTaskId: "", mode: "learn" }, () => nextLearnTask(sessionId));
}

export async function endSessionAction(sessionId: string, mode: "learn" | "practice") {
  await requireAuth();
  await endSession(sessionId);
  revalidatePath(sessionPath(mode, sessionId));
}
