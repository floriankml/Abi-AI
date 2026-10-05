import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";

/** Für Docker-Healthcheck und Monitoring. Gibt keine Daten preis. */
export async function GET() {
  try {
    getDb().$client.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
