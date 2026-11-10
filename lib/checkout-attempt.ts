/**
 * 会計画面の「注文確定の試行」を表す。注文作成APIへは clientRequestId として送り、
 * 応答が届かずに再送した場合でもサーバー側で同じ注文として扱われる（二重注文・二重課金の防止）。
 * 同じ内容での再送時はクーポン予約も最初の試行で取得したものを使い回す。
 * ページの再読み込みをまたいでも同じ試行を続けられるよう sessionStorage に保存する。
 */
export interface CheckoutAttempt {
  requestId: string
  /** 注文内容（カート・ポイント・クーポン・支払い方法など）の指紋。内容が変わったら新しい試行にする */
  fingerprint: string
  couponDeliveryId: string | null
  couponDiscountAmount: number
}

function generateRequestId(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  // 古いブラウザ向けの UUID v4
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function loadCheckoutAttempt(storageKey: string): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as CheckoutAttempt) : null
  } catch {
    return null
  }
}

export function saveCheckoutAttempt(storageKey: string, attempt: CheckoutAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(storageKey, JSON.stringify(attempt))
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* ignore */
  }
}

export function newCheckoutAttempt(fingerprint: string): CheckoutAttempt {
  return { requestId: generateRequestId(), fingerprint, couponDeliveryId: null, couponDiscountAmount: 0 }
}
