import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistische Prüfung: ohne Sitzungs-Cookie direkt zur Anmeldung.
 * Die eigentliche Prüfung der Signatur passiert serverseitig (requireAuth).
 */
export function proxy(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();
  if (!request.cookies.has("abios_session")) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico|icon|manifest).*)"],
};
