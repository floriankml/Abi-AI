import { SessionView } from "@/components/session-view";
import { requireAuth } from "@/server/auth";

// KI-Anfragen (Server Actions dieser Seite) dürfen länger dauern.
export const maxDuration = 120;

export const metadata = { title: "Lernen" };

export default async function LearnSessionPage({ params }: PageProps<"/lernen/[id]">) {
  await requireAuth();
  const { id } = await params;
  return <SessionView sessionId={id} mode="learn" />;
}
