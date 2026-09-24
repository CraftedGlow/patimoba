import { STORAGE_KEY, type AuthUser } from "@/lib/auth-context"

interface LiffLoginResult {
  authUser: AuthUser
  returnPath: string | null
}

export async function completeLiffLogin(liff: any): Promise<LiffLoginResult> {
  const idToken = liff.getIDToken()
  if (!idToken) throw new Error("IDトークンを取得できませんでした")

  // クーポン獲得も同じリクエストにまとめて往復回数を減らす
  const pendingCouponToken = sessionStorage.getItem("patimoba_pending_coupon_token")
  if (pendingCouponToken) {
    sessionStorage.removeItem("patimoba_pending_coupon_token")
  }

  const res = await fetch("/api/line/liff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      liffId: liff.id,
      couponToken: pendingCouponToken || undefined,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${body.error || "login_failed"}${body.detail ? ": " + body.detail : ""}`)
  }

  const result = await res.json()
  const { user, otp, coupon, couponAlreadyUsed, couponStoreId } = result

  if (otp) {
    const { supabase } = await import("@/lib/supabase")
    await supabase.auth.verifyOtp({
      email: otp.email,
      token: otp.token,
      type: "magiclink",
    })

    // ログイン中の本人の「今の」LINE表示名・アイコンをそのまま反映する。
    // アカウント確定（IDトークン検証・OTPログイン）は既に終わっているので、
    // ここで待っても LINE の複数回リロードで壊れる心配はない。むしろ
    // 更新が完了する前に画面側がDBを読みに行ってしまうと反映が一回遅れて
    // しまうため、ここで待ってから次に進む。
    try {
      const p: { displayName?: string; pictureUrl?: string } = await liff.getProfile()
      if (p.displayName || p.pictureUrl) {
        await supabase
          .from("users")
          .update({
            ...(p.displayName ? { line_name: p.displayName } : {}),
            ...(p.pictureUrl ? { avatar_url: p.pictureUrl } : {}),
          })
          .eq("id", user.id)
        if (p.displayName) user.line_name = p.displayName
        if (p.pictureUrl) user.avatar_url = p.pictureUrl
      }
    } catch (profileErr) {
      console.warn("[LIFF] プロフィール同期に失敗:", profileErr)
    }
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

  if (coupon) {
    // miniapp.line.me のクエリ形式ではURLに店舗パスが無いため、クーポン自身が
    // 持つ store_id から遷移先を決定する（returnPath があればそちらを優先）
    const nextPath = returnPath || (coupon.storeId ? `/customer/takeout/store/${coupon.storeId}` : "/customer/takeout")
    sessionStorage.setItem(
      "patimoba_claimed_coupon",
      JSON.stringify({
        title: coupon.title,
        discountLabel: coupon.discountLabel,
        minOrderAmount: coupon.minOrderAmount,
        wholeCakeOnly: coupon.wholeCakeOnly,
        validFrom: coupon.validFrom,
        expiresAt: coupon.expiresAt,
        nextPath,
      })
    )
    return { authUser, returnPath: "/customer/coupons/claimed" }
  }

  if (couponAlreadyUsed) {
    const nextPath = returnPath || (couponAlreadyUsed.storeId ? `/customer/takeout/store/${couponAlreadyUsed.storeId}` : "/customer/takeout")
    sessionStorage.setItem(
      "patimoba_claimed_coupon",
      JSON.stringify({ title: couponAlreadyUsed.title, alreadyUsed: true, nextPath })
    )
    return { authUser, returnPath: "/customer/coupons/claimed" }
  }

  // LINE側が同じリンクを短時間に複数回リロードし、completeLiffLogin が連続で
  // 呼ばれるケースが確認されている。先行の呼び出しで既にクーポンを獲得済み
  // （= patimoba_claimed_coupon が未消費のまま残っている）なら、今回
  // coupon が無くても獲得画面へ誘導する。そうしないと後続の呼び出しが
  // window.location.replace() で先行の遷移を上書きしてしまう。
  if (sessionStorage.getItem("patimoba_claimed_coupon")) {
    return { authUser, returnPath: "/customer/coupons/claimed" }
  }

  // クーポンを獲得できなかった場合（期間外・無効化済みなど）も、リンクが指す
  // 店舗自体は判明しているので、店舗選択の一覧画面に落とさずその店舗へ誘導する
  if (!returnPath && couponStoreId) {
    return { authUser, returnPath: `/customer/takeout/store/${couponStoreId}` }
  }

  return { authUser, returnPath }
}
