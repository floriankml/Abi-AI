import Link from "next/link";
import type { Session } from "@/server/db/schema";
import { getSubject, topicPath } from "@/server/services/subjects";
import { formatDateTime } from "@/lib/format";
import { Badge, SubjectDot } from "./ui";

export function SessionList({ sessions, base }: { sessions: Session[]; base: "/lernen" | "/ueben" }) {
  if (sessions.length === 0) return <p className="text-sm text-muted">Noch keine Sitzungen.</p>;
  return (
    <ul className="divide-y divide-border">
      {sessions.map((s) => {
        const subject = getSubject(s.subjectId);
        const path = topicPath(s.topicId);
        return (
          <li key={s.id}>
            <Link href={`${base}/${s.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-accent">
              <SubjectDot color={subject?.color ?? "#999"} />
              <span className="min-w-0 flex-1 truncate">
                {subject?.name}
                {path.length > 0 && <span className="text-muted"> · {path.at(-1)}</span>}
              </span>
              <span className="text-xs text-muted">{formatDateTime(s.startedAt)}</span>
              {!s.endedAt && <Badge tone="accent">offen</Badge>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
