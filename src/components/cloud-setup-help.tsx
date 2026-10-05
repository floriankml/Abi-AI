import { cloudSetupProblems } from "@/server/deployment";
import { AuthShell } from "./auth-shell";
import { Card } from "./ui";

/** Zeigt eine Anleitung, falls in der Cloud noch etwas fehlt; sonst nichts. */
export function CloudSetupHelp() {
  const problems = cloudSetupProblems();
  if (problems.length === 0) return null;
  return (
    <AuthShell subtitle="Fast geschafft – in Vercel fehlt noch etwas.">
      <Card className="space-y-4">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {problems.map((p) => (
            <li key={p.title}>
              <p className="font-medium">{p.title}</p>
              <p className="text-muted">{p.how}</p>
            </li>
          ))}
        </ol>
        <p className="border-t border-border pt-3 text-sm text-muted">
          Danach unter <strong>Deployments</strong> die neueste Version öffnen → „⋯“ → <strong>Redeploy</strong>, dann
          diese Seite neu laden.
        </p>
      </Card>
    </AuthShell>
  );
}
