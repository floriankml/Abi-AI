import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOpenAiCompatibleProvider } from "@/server/ai/providers/openai-compatible";
import { AiError, parseJsonText, repairLatexEscapes } from "@/server/ai/provider";
import { evaluationSchema } from "@/server/ai/schemas";
import { buildFtsQuery, resolveRefs, stripRefs } from "@/server/services/retrieval";

// Nachgebauter OpenAI-kompatibler Server (wie Gemini/Ollama/Mistral).
let server: http.Server;
let baseUrl = "";
let lastBody: Record<string, unknown> = {};
let reply: { status: number; content: string } = { status: 200, content: "{}" };
/** Modelle, die mit 503 antworten (simulierte Überlastung). */
let overloaded = new Set<string>();
const seenModels: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw);
      seenModels.push(String(lastBody.model));
      if (overloaded.has(String(lastBody.model))) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "high demand" } }));
        return;
      }
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(
        reply.status === 200
          ? JSON.stringify({
              id: "x",
              object: "chat.completion",
              created: 0,
              model: lastBody.model,
              choices: [{ index: 0, message: { role: "assistant", content: reply.content }, finish_reason: "stop" }],
              usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
            })
          : JSON.stringify({ error: { message: "nope" } }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => server.close());

const provider = (jsonMode: "json_object" | "json_schema" = "json_object") =>
  createOpenAiCompatibleProvider({ baseUrl, apiKey: "k", modelFast: "fast-m", modelStrong: "strong-m", jsonMode });

describe("openai-compatible provider", () => {
  it("sendet Schema im Prompt, wählt Modell nach Stufe und parst JSON mit Code-Zaun", async () => {
    reply = { status: 200, content: '```json\n{"ok": true}\n```' };
    const res = await provider().generateJson({
      task: "t",
      tier: "strong",
      system: "SYS",
      prompt: "P",
      schema: evaluationSchema,
    });
    expect(res.data).toEqual({ ok: true });
    expect(res.usage).toEqual({ input: 11, output: 7 });
    expect(lastBody.model).toBe("strong-m");
    expect(lastBody.response_format).toEqual({ type: "json_object" });
    const messages = lastBody.messages as { role: string; content: string }[];
    expect(messages[0].content).toContain("SYS");
    expect(messages[0].content).toContain('"verdict"');
  });

  it("nutzt json_schema, wenn konfiguriert", async () => {
    reply = { status: 200, content: "{}" };
    await provider("json_schema").generateJson({ task: "evaluateAnswer", tier: "fast", system: "", prompt: "", schema: evaluationSchema });
    expect(lastBody.model).toBe("fast-m");
    expect((lastBody.response_format as { type: string }).type).toBe("json_schema");
  });

  it("übersetzt HTTP-Fehler in verständliche Fehlercodes", async () => {
    reply = { status: 401, content: "" };
    await expect(
      provider().generateJson({ task: "t", tier: "fast", system: "", prompt: "", schema: evaluationSchema }),
    ).rejects.toMatchObject({ code: "auth" });
  });
});

describe("Ausweichmodelle", () => {
  it("weicht bei Überlastung auf das nächste Modell aus", async () => {
    overloaded = new Set(["fast-m"]);
    seenModels.length = 0;
    reply = { status: 200, content: '{"ok":1}' };
    const p = createOpenAiCompatibleProvider({
      baseUrl,
      apiKey: "k",
      modelFast: "fast-m",
      modelStrong: "strong-m",
      modelFallbacks: ["backup-m"],
      jsonMode: "json_object",
    });
    const res = await p.generateJson({ task: "t", tier: "fast", system: "", prompt: "", schema: evaluationSchema });
    expect(res.model).toBe("backup-m");
    expect(seenModels.at(-1)).toBe("backup-m");
    overloaded = new Set();
  }, 30_000);
});

describe("parseJsonText", () => {
  it("findet JSON auch mit Begleittext", () => {
    expect(parseJsonText('Hier: {"a": 1} fertig')).toEqual({ a: 1 });
  });
  it("wirft bei Unsinn einen invalid_output-Fehler", () => {
    expect(() => parseJsonText("kein json")).toThrow(AiError);
  });
});

describe("retrieval helpers", () => {
  it("baut eine sichere FTS-Abfrage ohne Stoppwörter", () => {
    expect(buildFtsQuery('Die "Lagebeziehungen" von Geraden!')).toBe('"lagebeziehungen"* OR "geraden"*');
    expect(buildFtsQuery("und der die")).toBeNull();
  });
  it("löst Referenzen der KI auf, ignoriert erfundene", () => {
    const src = { materialId: "m", chunkId: "c1", title: "T", page: 2 };
    const snippets = [{ ref: "M1", title: "T", page: 2, category: "notes", text: "", source: src }];
    expect(resolveRefs(["[M1]", "m1", "M9"], snippets)).toEqual([src]);
  });
});

describe("stripRefs", () => {
  it("entfernt Material-IDs aus angezeigten Texten", () => {
    expect(stripRefs("Die Aussage ist falsch [M1]. Das gilt (M2, M3) allgemein.")).toBe("Die Aussage ist falsch. Das gilt allgemein.");
    expect(stripRefs("Begründen Sie unter Verwendung von [M1].")).toBe("Begründen Sie.");
    expect(stripRefs("Schau in M1 nach.")).toBe("Schau nach.");
    expect(stripRefs("Matrix M = [1 2]")).toBe("Matrix M = [1 2]");
  });
});

describe("LaTeX in JSON-Antworten", () => {
  it("repariert einfache Backslashes und erhält korrekte Escapes", () => {
    // So schreiben Modelle häufig: LaTeX mit nur einem Backslash.
    const raw = String.raw`{"a": "$\vec{u} \cdot \vec{v} = 0$", "b": "$\frac{1}{2} \neq \times$", "c": "Zeile1\nZeile2 \"zitiert\""}`;
    expect(parseJsonText(raw)).toEqual({
      a: String.raw`$\vec{u} \cdot \vec{v} = 0$`,
      b: String.raw`$\frac{1}{2} \neq \times$`,
      c: 'Zeile1\nZeile2 "zitiert"',
    });
  });
  it("lässt korrekt escapte LaTeX-Texte unverändert", () => {
    const ok = JSON.stringify({ a: String.raw`$\frac{a}{b} \vec{n} \text{cm}$`, b: "x\ty\nz" });
    expect(repairLatexEscapes(ok)).toBe(ok);
    expect(parseJsonText(ok)).toEqual(JSON.parse(ok));
  });
});
