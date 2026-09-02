import { STORAGE_KEY, type AuthUser } from "@/lib/auth-context"

interface LiffLoginResult {
  authUser: AuthUser
  returnPath: string | null
}

export async function completeLiffLogin(liff: any): Promise<LiffLoginResult> {
  const idToken = liff.getIDToken()
  if (!idToken) throw new Error("IDトークンを取得できませんでした")

  // liff.getProfile() で最新のLINE表示名・アイコンを取得（IDトークンはキャッシュされる場合がある）
  let lineProfile: { displayName?: string; pictureUrl?: string } = {}
  try {
    const p = await liff.getProfile()
    lineProfile = { displayName: p.displayName, pictureUrl: p.pictureUrl }
    console.log("[LIFF] getProfile 成功:", p.displayName)
  } catch (profileErr) {
    console.warn("[LIFF] getProfile 失敗（IDトークンにフォールバック）:", profileErr)
  }

  const res = await fetch("/api/line/liff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      liffId: liff.id,
      lineName: lineProfile.displayName,
      avatarUrl: lineProfile.pictureUrl,
    }),
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

  const pendingCouponToken = sessionStorage.getItem("patimoba_pending_coupon_token")
  if (pendingCouponToken) {
    sessionStorage.removeItem("patimoba_pending_coupon_token")
    try {
      const claimRes = await fetch("/api/coupons/claim-by-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pendingCouponToken, userId: user.id }),
      })
      if (claimRes.ok) {
        const claimData = await claimRes.json()
        if (claimData.coupon) {
          sessionStorage.setItem(
            "patimoba_claimed_coupon",
            JSON.stringify({ title: claimData.coupon.title, discountLabel: claimData.coupon.discountLabel, nextPath: returnPath || "/customer/takeout" })
          )
          return { authUser, returnPath: "/customer/coupons/claimed" }
        }
      }
    } catch {
      // ベストエフォート。クーポン獲得に失敗してもログイン自体は成立させる
    }
  }

  return { authUser, returnPath }
}
