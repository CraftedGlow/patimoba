import { STORAGE_KEY } from "@/lib/auth-context"

type Navigate = (path: string) => void

export async function completeLiffLogin(
  liff: any,
  navigate: Navigate
): Promise<void> {
  const idToken = liff.getIDToken()
  if (!idToken) throw new Error("IDトークンを取得できませんでした")

  const res = await fetch("/api/line/liff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "ログインに失敗しました")
  }

  const result = await res.json()

  if (result.action === "register") {
    sessionStorage.removeItem("liff_login_pending")
    navigate("/customer/line-register")
    return
  }

  if (result.action === "signup") {
    sessionStorage.removeItem("liff_login_pending")
    sessionStorage.setItem("liff_signup_link_user_id", result.userId)
    navigate("/customer/signup")
    return
  }

  const { user, otp } = result

  if (otp) {
    const { supabase } = await import("@/lib/supabase")
    await supabase.auth.verifyOtp({
      email: otp.email,
      token: otp.token,
      type: "magiclink",
    })
  }

  const nameParts = (user.name || user.line_name || "").split(" ")
  const authUser = {
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
  navigate(returnPath || "/customer/takeout")
}
