"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SESSION_COOKIE,
  checkPassword,
  createSessionToken,
  loginBlocked,
  requireAuth,
  sessionCookieOptions,
} from "@/server/auth";
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

export type ActionState = { error?: string; ok?: boolean } | undefined;

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
  if (loginBlocked()) return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };
  if (!checkPassword(String(formData.get("password") ?? ""))) return { error: "Falsches Passwort." };
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  redirect("/");
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
    createSubject(subjectInput.parse(Object.fromEntries(formData)));
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
    updateSubject(id, subjectInput.parse(Object.fromEntries(formData)));
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveSubjectAction(formData: FormData) {
  await requireAuth();
  archiveSubject(z.string().parse(formData.get("id")));
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
    createTopic(input);
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
    updateTopic(input.id, input);
  } catch (err) {
    return { error: toMessage(err) };
  }
  revalidatePath("/faecher");
  return { ok: true };
}

export async function deleteTopicAction(formData: FormData) {
  await requireAuth();
  deleteTopic(z.string().parse(formData.get("id")));
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
  deleteMaterial(z.string().parse(formData.get("id")));
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
  endSession(sessionId);
  revalidatePath(sessionPath(mode, sessionId));
}
