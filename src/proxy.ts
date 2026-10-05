import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistische Prüfung: ohne Sitzungs-Cookie direkt zur Anmeldung (bzw. die
 * Anmeldeseite leitet zur Einrichtung weiter). Die eigentliche Prüfung der
 * Signatur passiert serverseitig (requireAuth).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("abios_session")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|einrichten|api/health|_next/static|_next/image|favicon.ico|icon|manifest).*)"],
};
