import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (
      (pathname.startsWith("/artiste/revenus") || pathname.startsWith("/artiste/gestion") || pathname.startsWith("/son/nouveau")) &&
      role !== "artist" &&
      role !== "admin"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // /artiste/[id] (profil public), /album/[id], /playlist/[id] (si
  // publique), /son/[id] restent volontairement HORS de ce matcher :
  // n'importe qui doit pouvoir les consulter.
  matcher: [
    "/admin/:path*",
    "/artiste/revenus/:path*",
    "/artiste/gestion/:path*",
    "/son/nouveau",
    "/compte/:path*",
    "/bibliotheque/:path*",
    "/notifications/:path*",
  ],
};
