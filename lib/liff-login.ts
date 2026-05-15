import { STORAGE_KEY, type AuthUser } from "@/lib/auth-context"

interface LiffLoginResult {
  authUser: AuthUser
  returnPath: string | null
}

export async function completeLiffLogin(liff: any): Promise<LiffLoginResult> {
  const idToken = liff.getIDToken()
  if (!idToken) throw new Error("IDトークンを取得できませんでした")

  const res = await fetch("/api/line/liff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${body.error || "login_failed"}${body.detail ? ": " + body.detail : ""}`)
  }

  const result = await res.json()
  const { user, otp } = result

  if (otp) {
    const { supabase } = await import("@/lib/supabase")
    await supabase.auth.verifyOtp({
      email: otp.email,
      token: otp.token,
      type: "magiclink",
    })
  }

  const nameParts = (user.line_name || user.name || "").split(" ")
  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? "",
    userType: "customer" as const,
    firstName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
    lastName: nameParts[0] ?? "",
    storeId: null,
    raw: user,
  }

  sessionStorage.removeItem("liff_login_pending")
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))

  const returnPath = sessionStorage.getItem("liff_return_path")
  sessionStorage.removeItem("liff_return_path")

  return { authUser, returnPath }
}
