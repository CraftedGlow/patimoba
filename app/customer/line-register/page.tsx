import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LineRegisterClient } from "./client"

export default async function LineRegisterPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get("line_pending_user")?.value

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
