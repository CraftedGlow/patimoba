import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LINE_PENDING_USER_PURPOSE, verifySignedValue } from "@/lib/signed-value"
import { LineRegisterClient } from "./client"

export default async function LineRegisterPage() {
  const cookieStore = await cookies()
  // サーバーが署名して発行した値のみ受け付ける（app/api/line/register と同じ検証）
  const raw = verifySignedValue(LINE_PENDING_USER_PURPOSE, cookieStore.get("line_pending_user")?.value)

  if (!raw) {
    redirect("/customer/login?error=session_expired")
  }

  let lineName = ""
  let avatarUrl: string | null = null
  try {
    const pendingUser = JSON.parse(raw)
    lineName = pendingUser.lineName ?? ""
    avatarUrl = pendingUser.avatarUrl ?? null
  } catch {
    redirect("/customer/login?error=invalid_session")
  }

  return <LineRegisterClient lineName={lineName} avatarUrl={avatarUrl} />
}
