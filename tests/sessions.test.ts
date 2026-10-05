import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Eigene Test-Datenbank und Test-KI, bevor Server-Module geladen werden.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abios-test-"));
process.env.DATA_DIR = dir;
process.env.AI_PROVIDER = "mock";
process.env.AI_MODEL_FAST = "mock";

type Sessions = typeof import("@/server/services/sessions");
let s: Sessions;
let subjectId = "";

beforeAll(async () => {
  s = await import("@/server/services/sessions");
  const { listSubjects } = await import("@/server/services/subjects");
  subjectId = listSubjects().find((x) => x.name === "Mathematik")!.id;
});

describe("Lernmodus – Freigaberegeln", () => {
  it("gibt Lösung und Hinweise erst nach eigenen Versuchen frei", async () => {
    const id = await s.startLearnSession({ subjectId, topicId: null, focus: null });
    let view = s.getSessionView(id)!;
    expect(view.items).toHaveLength(3); // Diagnose
    const task = view.current!;
    expect(task.solution).toBeNull();
    expect(task.hints).toHaveLength(0);
    expect(() => s.revealHint(task.id)).toThrow(s.SessionError);
    await expect(s.revealSolution(task.id)).rejects.toThrow(s.SessionError);

    await s.submitAnswer({ sessionTaskId: task.id, answer: "5", durationS: 10, giveUp: false });
    view = s.getSessionView(id)!;
    expect(view.current!.attempts[0].evaluation.verdict).toBe("incorrect");
    expect(view.current!.solution).toBeNull();
    expect(view.current!.canRevealSolution).toBe(false);

    s.revealHint(task.id);
    s.revealHint(task.id);
    expect(() => s.revealHint(task.id)).toThrow(s.SessionError);
    view = s.getSessionView(id)!;
    expect(view.current!.hints).toHaveLength(2);
    expect(view.current!.canRevealSolution).toBe(true);

    await s.revealSolution(task.id);
    view = s.getSessionView(id)!;
    const done = view.items[0];
    expect(done.status).toBe("done");
    expect(done.solution).toContain("4");
    expect(done.explanation).toContain("Quelle");
    // Nach Abschluss keine weiteren Antworten.
    await expect(s.submitAnswer({ sessionTaskId: task.id, answer: "4", durationS: 1, giveUp: false })).rejects.toThrow();
  });

  it("stellt nach einer nicht gelösten Aufgabe eine Kontrollfrage", async () => {
    const id = await s.startLearnSession({ subjectId, topicId: null, focus: null });
    for (const item of s.getSessionView(id)!.items) {
      await s.submitAnswer({ sessionTaskId: item.id, answer: "", durationS: 1, giveUp: true });
      s.finishTask(item.id); // Diagnosefragen dürfen nach einem Versuch abgeschlossen werden
    }
    await s.nextLearnTask(id);
    const view = s.getSessionView(id)!;
    expect(view.items.at(-1)!.purpose).toBe("check");
    expect(view.current!.purpose).toBe("check");
    // Im Lernmodus führt der Weg über Hinweise, nicht über "Abschließen".
    await s.submitAnswer({ sessionTaskId: view.current!.id, answer: "7", durationS: 1, giveUp: false });
    expect(() => s.finishTask(view.current!.id)).toThrow(s.SessionError);
  });
});

describe("Übungsmodus", () => {
  it("erlaubt Abschließen nach einem Versuch und zeigt dann die Lösung", async () => {
    const id = await s.startPracticeSession({
      subjectId,
      topicId: null,
      difficulty: 3,
      type: "mixed",
      count: 2,
      timeLimitMin: null,
      focus: null,
    });
    const view = s.getSessionView(id)!;
    expect(view.items).toHaveLength(2);
    const first = view.current!;
    expect(() => s.finishTask(first.id)).toThrow(s.SessionError);
    await s.submitAnswer({ sessionTaskId: first.id, answer: "3", durationS: 5, giveUp: false });
    s.finishTask(first.id);
    const after = s.getSessionView(id)!;
    expect(after.items[0].solution).not.toBeNull();
    expect(after.current!.id).toBe(after.items[1].id);
  });

  it("verweigert Aktionen in beendeten Sitzungen", async () => {
    const id = await s.startPracticeSession({
      subjectId,
      topicId: null,
      difficulty: 2,
      type: "short",
      count: 1,
      timeLimitMin: null,
      focus: null,
    });
    s.endSession(id);
    const item = s.getSessionView(id)!.items[0];
    await expect(s.submitAnswer({ sessionTaskId: item.id, answer: "4", durationS: 1, giveUp: false })).rejects.toThrow(
      "beendet",
    );
  });
});
