import { queryAll } from "../db/client";

export async function aiUsageSummary(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return queryAll<{ model: string; calls: number; input: number; output: number; failed: number }>(
    `SELECT model, COUNT(*) AS calls, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
            SUM(CASE WHEN ok THEN 0 ELSE 1 END) AS failed
     FROM ai_usage WHERE created_at >= ? GROUP BY model ORDER BY calls DESC`,
    [since],
  );
}
