import { NextResponse } from "next/server"

// DELETE /api/line/auth/session
// /customer/line-callback でログイン確立後、セッション引き渡し用の httpOnly クッキーを削除する
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set("line_session_uid", "", { httpOnly: true, maxAge: 0, path: "/", sameSite: "lax" })
  return response
}
