import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  const requestHeaders = new Headers(request.headers);

  // Exclude local dev and main platform domains from custom domain lookup
  const isPlatformDomain = 
    host.includes('localhost') || 
    host.includes('127.0.0.1') || 
    host === 'app.schoolos.ma' ||
    host === 'schoolos.ma';

  if (!isPlatformDomain) {
    try {
      // Internal API fetch to resolve the custom domain to a tenant.
      // We hardcode 127.0.0.1 and the application's actual PORT (default 3000) 
      // because middleware runs in the Edge runtime and cannot query the DB directly.
      const fetchUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/platform/edge-tenant-resolve?domain=${encodeURIComponent(host)}`;
      
      const res = await fetch(fetchUrl, {
        headers: { 'x-middleware-bypass': '1' }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          requestHeaders.set('x-tenant-slug', json.data.slug);
          requestHeaders.set('x-tenant-id', json.data.tenantId);
        }
      }
    } catch (e) {
      // If this internal fetch fails (e.g. network blip or route not ready), 
      // we deliberately fail OPEN by swallowing the error and returning without tenant headers.
      // This ensures the platform doesn't completely crash for all traffic if the resolver hiccups,
      // and invalid/unrecognized domains will just naturally fall through to the default experience.
      console.error('Middleware edge-tenant-resolve failed:', e);
    }
  }

  // Extract locale from path or default to 'fr'
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';

  // If missing locale prefix on dashboard or login routes, redirect to localized URL
  if (!localeMatch && (pathname.startsWith('/dashboard') || pathname === '/login')) {
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
  }

  // Extract session token from cookies
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  // Match dashboard page routes
  const isDashboardRoute = /^\/([a-z]{2}\/)?dashboard(\/.*)?$/.test(pathname);

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
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - static asset files ending with extensions like .png, .jpg, .css, .js, .svg
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp4|webm)).*)',
  ],
};
