import { SessionView } from "@/components/session-view";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Lernen" };

export default async function LearnSessionPage({ params }: PageProps<"/lernen/[id]">) {
  await requireAuth();
  const { id } = await params;
  return <SessionView sessionId={id} mode="learn" />;
}
