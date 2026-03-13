import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/auth/callback',
  '/privacy',
  '/map',
];
// /api routes handle their own JWT auth via FastAPI — do not redirect them
const PUBLIC_PREFIXES = ['/shops', '/api'];

// Routes that require session but NOT pdpa consent
const ONBOARDING_ROUTES = ['/onboarding/consent'];

// Routes that require session + consent but serve deletion recovery
const RECOVERY_ROUTES = ['/account/recover'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabaseResponse } = await updateSession(request);

  // Public routes — pass through
  if (isPublicRoute(pathname)) {
    return supabaseResponse;
  }

  // No session — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  // Check custom claims from JWT
  const appMetadata = user.app_metadata || {};
  const pdpaConsented = appMetadata.pdpa_consented === true;
  const deletionRequested = appMetadata.deletion_requested === true;

  // Recovery routes — must be checked before the deletion guard so deletion-pending
  // users can still reach /account/recover
  if (RECOVERY_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // Deletion pending — redirect to recovery (checked before onboarding so
  // deletion-pending users can't reach consent page either)
  if (deletionRequested) {
    const url = request.nextUrl.clone();
    url.pathname = '/account/recover';
    return NextResponse.redirect(url);
  }

  // Onboarding routes — just need session (no consent required yet)
  if (ONBOARDING_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // No PDPA consent — redirect to onboarding, preserving the intended destination
  if (!pdpaConsented) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding/consent';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  // Admin routes — require is_admin flag in JWT app_metadata.
  // To grant admin access: in Supabase dashboard → Authentication → Users →
  // select user → Edit → app_metadata → set {"is_admin": true}
  // The backend require_admin dependency also validates against settings.admin_user_ids.
  if (pathname.startsWith('/admin')) {
    const isAdmin = appMetadata.is_admin === true;
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Authenticated + consented — pass through
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
