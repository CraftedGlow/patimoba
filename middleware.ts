import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // LINE OAuth から LIFF エンドポイント（root）に戻るコールバックを /login へリダイレクト
  if (
    pathname === "/" &&
    searchParams.has("code") &&
    searchParams.has("liffClientId")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url, { status: 302 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/",
}
