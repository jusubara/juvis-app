// import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// TODO: Supabase 유료 전환 후 인증 다시 활성화
export async function middleware(_request: NextRequest) {
  void _request;
  return NextResponse.next();

  /* ─── 인증 체크 및 /login 리다이렉트 로직 (비활성화됨) ───────────────────
  let response = NextResponse.next({
    request: { headers: _request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return _request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            _request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: _request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 갱신 (토큰 만료 시 자동 refresh)
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = _request.nextUrl;

  // 로그인 안 된 상태 → /login으로 리다이렉트
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', _request.url));
  }

  // 이미 로그인된 상태에서 /login 접근 → / 로 리다이렉트
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', _request.url));
  }

  return response;
  ─────────────────────────────────────────────────────────────────────── */
}

export const config = {
  matcher: [
    // static, _next 내부 파일, API 라우트 제외
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
