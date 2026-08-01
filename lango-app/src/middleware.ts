import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract session token from cookies
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  // Match dashboard page routes
  const isDashboardRoute = /^\/([a-z]{2}\/)?dashboard(\/.*)?$/.test(pathname);
  const isSuperAdminRoute = /^\/([a-z]{2}\/)?dashboard\/super-admin(\/.*)?$/.test(pathname);
  const isLoginRoute = /^\/([a-z]{2}\/)?login$/.test(pathname);

  // Extract locale from path or default to 'fr'
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';

  if (isDashboardRoute && !sessionToken) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ponytail: no "already logged in -> bounce away from /login" redirect here.
  // This middleware only checks whether the session COOKIE is present, never
  // whether it's actually valid - `(dashboard)/layout.tsx` does the real check
  // via `auth.api.getSession()` against the database. A stale cookie (session
  // deleted/expired server-side, e.g. after a DB reset) used to disagree with
  // that real check forever: dashboard sees the cookie -> passes through ->
  // real check fails -> redirect to /login; /login sees the same cookie ->
  // this rule bounced it straight back to /dashboard -> infinite redirect
  // loop (ERR_TOO_MANY_REDIRECTS). The login page has no server-side "already
  // authenticated" redirect of its own, so removing this doesn't drop a
  // working feature - it only removes the one that was actually broken.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
