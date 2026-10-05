import { NextResponse } from "next/server";
import { queryOne } from "@/server/db/client";

/** Für Docker-Healthcheck und Monitoring. Gibt keine Daten preis. */
export async function GET() {
  try {
    await queryOne("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[health]", err instanceof Error ? err.message : err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
