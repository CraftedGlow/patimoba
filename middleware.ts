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
    // リダイレクトではなくリライト: ブラウザの URL は /?code=... のまま（LIFF 登録エンドポイントと一致）
    // LIFF SDK はブラウザの URL を参照するため、エンドポイント不一致エラーが出ない
    return NextResponse.rewrite(new URL("/liff-loading", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/",
}
