import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiError, mapHttpError, type AiProvider, type JsonRequest } from "../provider";

/** Modelle, die serverseitige Ausweichmodelle bei Ablehnungen unterstützen. */
const SUPPORTS_FALLBACKS = /^claude-(opus-5|sonnet-5-5|fable-5)/;

/** Adapter für die Claude-API (Anthropic) mit strukturierten Ausgaben. */
export function createAnthropicProvider(cfg: {
  apiKey: string;
  modelFast: string;
  modelStrong: string;
}): AiProvider {
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 2 });

  return {
    name: "anthropic",
    async generateJson(req: JsonRequest) {
      const model = req.tier === "strong" ? cfg.modelStrong : cfg.modelFast;
      const fallbacks = SUPPORTS_FALLBACKS.test(model)
        ? { fallbacks: "default" as const, betas: ["server-side-fallback-2026-07-01"] }
        : {};

      let res;
      try {
        res = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
          output_config: { format: betaZodOutputFormat(req.schema) },
          ...fallbacks,
        });
      } catch (err) {
        if (err instanceof Anthropic.APIError) throw mapHttpError(err.status, err.message);
        throw new AiError("unavailable", String(err));
      }

      if (res.stop_reason === "refusal") throw new AiError("refused", "Anfrage abgelehnt");
      if (res.parsed_output == null) throw new AiError("invalid_output", "Keine strukturierte Ausgabe");

      return {
        data: res.parsed_output,
        model: res.model,
        usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
      };
    },
  };
}
