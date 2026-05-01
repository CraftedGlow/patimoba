import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI

  if (!channelId || !redirectUri) {
    return NextResponse.json(
      { error: "LINE Login is not configured" },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid",
  })

  const response = NextResponse.redirect(
    `https://access.line.me/oauth2/v2.1/authorize?${params}`
  )

  // CSRF対策: stateをhttpOnlyクッキーに保存 (5分間有効)
  response.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    maxAge: 300,
    path: "/",
    sameSite: "lax",
  })

  return response
}
