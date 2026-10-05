import OpenAI from "openai";
import { z } from "zod";
import { AiError, mapHttpError, parseJsonText, type AiProvider, type JsonRequest } from "../provider";

/**
 * Adapter für alle Anbieter mit OpenAI-kompatibler Chat-API:
 * Google Gemini, Mistral, Groq, OpenRouter, OpenAI, Ollama, LM Studio, …
 */
export function createOpenAiCompatibleProvider(cfg: {
  baseUrl: string;
  apiKey: string;
  modelFast: string;
  modelStrong: string;
  jsonMode: "json_object" | "json_schema";
}): AiProvider {
  const client = new OpenAI({
    baseURL: cfg.baseUrl || undefined,
    // Lokale Server (Ollama) brauchen keinen Schlüssel, das SDK aber einen String.
    apiKey: cfg.apiKey || "not-needed",
    maxRetries: 2,
    timeout: 120_000,
  });

  return {
    name: "openai-compatible",
    async generateJson(req: JsonRequest) {
      const model = req.tier === "strong" ? cfg.modelStrong : cfg.modelFast;
      const jsonSchema = z.toJSONSchema(req.schema);
      const system =
        req.system +
        "\n\nAntworte ausschließlich mit einem JSON-Objekt, das exakt diesem JSON-Schema entspricht:\n" +
        JSON.stringify(jsonSchema);

      let res;
      try {
        res = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: req.prompt },
          ],
          response_format:
            cfg.jsonMode === "json_schema"
              ? { type: "json_schema", json_schema: { name: req.task, schema: jsonSchema } }
              : { type: "json_object" },
        });
      } catch (err) {
        if (err instanceof OpenAI.APIError) throw mapHttpError(err.status, err.message);
        throw new AiError("unavailable", String(err));
      }

      const text = res.choices[0]?.message?.content ?? "";
      return {
        data: parseJsonText(text),
        model: res.model ?? model,
        usage: {
          input: res.usage?.prompt_tokens ?? 0,
          output: res.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
