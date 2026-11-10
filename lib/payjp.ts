import { createHmac, timingSafeEqual } from "crypto";

const PAYJP_API_BASE = "https://api.pay.jp/v1";

function getAuthHeader(): string {
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) throw new Error("PAYJP_SECRET_KEY is not set");
  return "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
}

export async function payjpPost(
  path: string,
  params: Record<string, string>,
  options: { idempotencyKey?: string } = {}
): Promise<Response> {
  const body = new URLSearchParams(params).toString();
  return fetch(`${PAYJP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      // 同じキーでの再送は PAY.JP 側で1回の処理として扱われる（通信エラー時の再試行で二重課金しない）
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body,
  });
}

export async function payjpGet(path: string): Promise<Response> {
  return fetch(`${PAYJP_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
}

export type PayjpChargeResult =
  | { ok: true; chargeId: string }
  | { ok: false; status: number; message: string; outcomeUnknown?: false }
  /** 通信エラー等で PAY.JP の応答が得られず、課金されたかどうか分からない */
  | { ok: false; status: 502; message: string; outcomeUnknown: true };

/**
 * 登録済みの PAY.JP 顧客（users.customer_id）に対してサーバー側で課金する。
 * 金額は必ずサーバー側でDBから確定した値を渡すこと（クライアント申告値は使わない）。
 * idempotencyKey（注文ID等）を付けて送り、通信エラー時は同じキーで1回だけ再試行する。
 */
export async function payjpChargeCustomer(params: {
  customerId: string;
  tenantId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<PayjpChargeResult> {
  const chargeParams = {
    amount: String(params.amount),
    currency: "jpy",
    customer: params.customerId,
    tenant: params.tenantId,
  };
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      res = await payjpPost("/charges", chargeParams, { idempotencyKey: params.idempotencyKey });
    } catch (e) {
      console.error("[payjp] 課金リクエスト例外:", { attempt, idempotencyKey: params.idempotencyKey }, e);
    }
  }
  if (!res) {
    return { ok: false, status: 502, message: "決済処理の結果を確認できませんでした", outcomeUnknown: true };
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok && !data?.id) {
    // 成功応答だが本文を読めなかった（課金されている可能性がある）
    return { ok: false, status: 502, message: "決済処理の結果を確認できませんでした", outcomeUnknown: true };
  }
  if (res.status >= 500) {
    // PAY.JP 側の障害応答は課金されたかどうか確定できない
    return { ok: false, status: 502, message: "決済処理の結果を確認できませんでした", outcomeUnknown: true };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: data?.error?.message ?? "決済処理に失敗しました" };
  }
  if (!data.paid) {
    // 与信のみ等で確定していない課金は使わない（念のため返金して失敗扱いにする）
    await payjpRefund(data.id);
    return { ok: false, status: 402, message: "決済処理に失敗しました" };
  }
  return { ok: true, chargeId: data.id };
}

/** 課金を全額返金する。成功したら true */
export async function payjpRefund(chargeId: string): Promise<boolean> {
  try {
    const res = await payjpPost(`/charges/${chargeId}/refund`, {});
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[payjp] 返金エラー:", chargeId, data?.error?.code ?? res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[payjp] 返金例外:", chargeId, e);
    return false;
  }
}

/**
 * 課金が返金済みかを PAY.JP に問い合わせる。確認できなかった場合は null。
 * 返金APIの応答が通信エラー等で得られず、実際に返金されたか不明なときの確認に使う。
 */
export async function payjpIsChargeRefunded(chargeId: string): Promise<boolean | null> {
  try {
    const res = await payjpGet(`/charges/${chargeId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.refunded === true;
  } catch (e) {
    console.error("[payjp] 課金状態の確認に失敗:", chargeId, e);
    return null;
  }
}

function tdsCallbackSigningKey(): string {
  const key = process.env.PAYJP_SECRET_KEY;
  if (!key) throw new Error("PAYJP_SECRET_KEY is not set");
  return key;
}

/**
 * 3DSリダイレクトのコールバックURL（?uid=）を第三者が別ユーザー向けに偽造できないよう、
 * uid に対するHMAC署名を付ける（start-tds で発行し、tds-callback で検証する）。
 */
export function signTdsCallbackUid(uid: string): string {
  return createHmac("sha256", tdsCallbackSigningKey()).update(`tds-callback:${uid}`).digest("hex");
}

export function verifyTdsCallbackUid(uid: string, sig: string | null): boolean {
  if (!sig) return false;
  const expected = Buffer.from(signTdsCallbackUid(uid), "utf8");
  const actual = Buffer.from(sig, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * オープンリダイレクト防止: 同一オリジン内の相対パス（"/" 始まり、"//" や "/\" 始まりでない）のみ許可。
 * URL パーサーはタブ・改行を取り除くため（"/<TAB>/evil.com" → "//evil.com"）、制御文字とバックスラッシュも拒否する
 */
export function isSafeReturnPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !/[\x00-\x1f\x7f\\]/.test(path)
  );
}
