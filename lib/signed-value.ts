import { createHmac, timingSafeEqual } from "crypto"

/**
 * サーバー専用: クッキー等でクライアントに預ける値を HMAC-SHA256 で署名・検証する。
 * 形式: <base64url(値)>.<有効期限(ミリ秒)>.<base64url(HMAC)>
 * 署名鍵はクライアントに露出しない LINE_LOGIN_CHANNEL_SECRET（無ければ SUPABASE_SERVICE_ROLE_KEY）。
 * purpose を署名対象に含めるので、ある用途で発行した値を別用途のクッキーに流用することはできない。
 */
/** LINE Login コールバック → /customer/line-callback へのセッション引き渡し（値: users.id） */
export const LINE_SESSION_PURPOSE = "line_session_uid"
/** LINE 連携済み・未登録ユーザーの登録待ち情報（値: JSON {lineUserId, lineName, avatarUrl}） */
export const LINE_PENDING_USER_PURPOSE = "line_pending_user"
/** 注文確認メールのリンクから、ログインなしで注文詳細の確認・キャンセルを行うための鍵（値: orders.id） */
const ORDER_ACCESS_PURPOSE = "order_access"
/** 注文確認メールのリンクの有効期間（受取・配送後の問い合わせにも使えるよう長めにする） */
const ORDER_ACCESS_TTL_SECONDS = 365 * 24 * 60 * 60
/** 注文詳細のリンクの鍵を API に渡すヘッダー名 */
export const ORDER_ACCESS_HEADER = "x-order-access-key"

function getSecret(): string {
  const secret = process.env.LINE_LOGIN_CHANNEL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("署名用シークレットが設定されていません")
  return secret
}

function hmac(purpose: string, payload: string): string {
  return createHmac("sha256", getSecret()).update(`${purpose}:${payload}`).digest("base64url")
}

export function signValue(purpose: string, value: string, ttlSeconds: number): string {
  const encoded = Buffer.from(value, "utf8").toString("base64url")
  const expiresAt = Date.now() + ttlSeconds * 1000
  const payload = `${encoded}.${expiresAt}`
  return `${payload}.${hmac(purpose, payload)}`
}

/** 署名と有効期限を検証し、正しければ元の値を返す（不正・期限切れは null） */
export function verifySignedValue(purpose: string, signed: string | undefined | null): string | null {
  if (!signed) return null
  const parts = signed.split(".")
  if (parts.length !== 3) return null
  const [encoded, expiresAtRaw, signature] = parts
  const payload = `${encoded}.${expiresAtRaw}`

  let expected: Buffer
  let actual: Buffer
  try {
    expected = Buffer.from(hmac(purpose, payload), "base64url")
    actual = Buffer.from(signature, "base64url")
  } catch {
    return null
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  return Buffer.from(encoded, "base64url").toString("utf8")
}

/** 注文確認メールに載せる、その注文専用の閲覧・キャンセル用の鍵を発行する */
export function createOrderAccessKey(orderId: string): string {
  return signValue(ORDER_ACCESS_PURPOSE, orderId, ORDER_ACCESS_TTL_SECONDS)
}

/** 鍵がこの注文のために発行された正しいものかどうか */
export function isValidOrderAccessKey(key: string | null | undefined, orderId: string): boolean {
  return verifySignedValue(ORDER_ACCESS_PURPOSE, key) === orderId
}
