import { STORAGE_KEY, type AuthUser } from "@/lib/auth-context"

interface LiffLoginResult {
  authUser: AuthUser
  returnPath: string | null
}

function debugLog(page: string, note?: string, hasPendingCouponToken?: boolean) {
  try {
    fetch("/api/debug/liff-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, url: window.location.href, note, hasPendingCouponToken }),
    }).catch(() => {})
  } catch {}
}

export async function completeLiffLogin(liff: any): Promise<LiffLoginResult> {
  debugLog("liff-login.ts:entry")
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
  debugLog("liff-login.ts:before-claim", `pendingCouponToken=${pendingCouponToken}`, !!pendingCouponToken)
  if (pendingCouponToken) {
    sessionStorage.removeItem("patimoba_pending_coupon_token")
    try {
      const claimRes = await fetch("/api/coupons/claim-by-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pendingCouponToken, userId: user.id }),
      })
      const claimData = await claimRes.json().catch(() => null)
      debugLog("liff-login.ts:claim-response", `status=${claimRes.status} body=${JSON.stringify(claimData)}`)
      if (claimRes.ok && claimData?.coupon) {
        sessionStorage.setItem(
          "patimoba_claimed_coupon",
          JSON.stringify({ title: claimData.coupon.title, discountLabel: claimData.coupon.discountLabel, nextPath: returnPath || "/customer/takeout" })
        )
        debugLog("liff-login.ts:redirect-to-claimed")
        return { authUser, returnPath: "/customer/coupons/claimed" }
      }
    } catch (claimErr: any) {
      debugLog("liff-login.ts:claim-error", claimErr?.message || String(claimErr))
      // ベストエフォート。クーポン獲得に失敗してもログイン自体は成立させる
    }
  }

  debugLog("liff-login.ts:return-normal", `returnPath=${returnPath}`)
  return { authUser, returnPath }
}
