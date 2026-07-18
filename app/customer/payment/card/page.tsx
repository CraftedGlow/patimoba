"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";
import { supabase } from "@/lib/supabase";

interface PayjpCardElement {
  mount(selector: string): void;
  on(
    event: string,
    handler: (e: { complete?: boolean; error?: { message: string } }) => void
  ): void;
  unmount(): void;
}
interface PayjpElements {
  create(
    type: "card" | "cardNumber" | "cardExpiry" | "cardCvc",
    options?: { style?: Record<string, unknown> }
  ): PayjpCardElement;
}
interface PayjpInstance {
  elements(): PayjpElements;
  createToken(
    element: PayjpCardElement,
    data?: {
      three_d_secure?: boolean;
      card?: { name?: string; phone?: string; email?: string };
    }
  ): Promise<{ id?: string; error?: { message: string } }>;
}
declare global {
  interface Window {
    Payjp?: (
      publicKey: string,
      options?: { threeDSecureWorkflow?: string; locale?: string }
    ) => PayjpInstance;
  }
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+81" + digits.slice(1);
  if (digits.startsWith("81")) return "+" + digits;
  return "+" + digits;
}

const steps = ["店舗選択", "商品選択", "受取日時", "決済情報"];

const elementStyle = {
  base: { color: "#111827", fontSize: "16px", "::placeholder": { color: "#d1d5db" } },
  invalid: { color: "#dc2626" },
};

export default function CardAddPage() {
  const router = useRouter();
  const { profile, points, userId, selectedStoreId } = useCustomerContext();

  const [name, setName] = useState("");
  const [userPhone, setUserPhone] = useState<string | null>(null);

  const [numberComplete, setNumberComplete] = useState(false);
  const [expiryComplete, setExpiryComplete] = useState(false);
  const [cvcComplete, setCvcComplete] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [cvcError, setCvcError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardNumberRef = useRef<PayjpCardElement | null>(null);
  const payjpRef = useRef<PayjpInstance | null>(null);
  const mountedRef = useRef(false);

  // ユーザーの電話番号を DB から取得（3DS 用）
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }: { data: { phone: string | null } | null }) => {
        if (data?.phone) setUserPhone(data.phone);
      });
  }, [userId]);

  // tds_error パラメータを URL から読み取る
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tdsError = params.get("tds_error");
    if (tdsError) setError(tdsError);
  }, []);

  // payjp.js v2 をロードしてカード要素をマウント
  useEffect(() => {
    if (mountedRef.current) return;

    const script = document.createElement("script");
    script.src = "https://js.pay.jp/v2/pay.js";
    script.onload = () => {
      if (!window.Payjp || mountedRef.current) return;
      mountedRef.current = true;

      const payjp = window.Payjp(
        process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY ?? "",
        { threeDSecureWorkflow: "redirect", locale: "ja" }
      );
      payjpRef.current = payjp;

      const elements = payjp.elements();

      const cardNumber = elements.create("cardNumber", { style: elementStyle });
      cardNumber.mount("#payjp-card-number");
      cardNumberRef.current = cardNumber;
      cardNumber.on("change", (e) => {
        setNumberComplete(!!e.complete);
        setNumberError(e.error?.message ?? null);
      });

      const cardExpiry = elements.create("cardExpiry", { style: elementStyle });
      cardExpiry.mount("#payjp-card-expiry");
      cardExpiry.on("change", (e) => {
        setExpiryComplete(!!e.complete);
        setExpiryError(e.error?.message ?? null);
      });

      const cardCvc = elements.create("cardCvc", { style: elementStyle });
      cardCvc.mount("#payjp-card-cvc");
      cardCvc.on("change", (e) => {
        setCvcComplete(!!e.complete);
        setCvcError(e.error?.message ?? null);
      });
    };
    document.body.appendChild(script);

    return () => {
      mountedRef.current = false;
      cardNumberRef.current = null;
      payjpRef.current = null;
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = async () => {
    if (!cardNumberRef.current || !payjpRef.current) return;
    if (!name.trim()) {
      setError("名義人を入力してください");
      return;
    }
    if (!userId) {
      setError("ログイン情報が見つかりません。再ログインしてください。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const cardData: { name: string; phone?: string } = { name: name.trim() };
    if (userPhone) cardData.phone = toE164(userPhone);

    const result = await payjpRef.current.createToken(cardNumberRef.current, {
      three_d_secure: true,
      card: cardData,
    });

    if (result.error || !result.id) {
      setError(result.error?.message ?? "カード情報の入力を確認してください");
      setSubmitting(false);
      return;
    }

    const returnPath =
      (() => {
        try {
          return sessionStorage.getItem("patimoba_tds_return_path");
        } catch {
          return null;
        }
      })() ?? "/customer/ec/confirm";

    const res = await fetch("/api/payjp/start-tds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token_id: result.id,
        user_id: userId,
        return_path: returnPath,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.redirectUrl) {
      setError(data.error ?? "3Dセキュア開始に失敗しました");
      setSubmitting(false);
      return;
    }

    try {
      sessionStorage.removeItem("patimoba_tds_return_path");
    } catch {
      /* ignore */
    }

    // 3DS リダイレクト後は LIFF コンテキストが失われるため、
    // LIFF が有効な今のうちに notification token を先取りして保存する
    try {
      const liff = (await import("@line/liff")).default;
      const liffAccessToken = liff.getAccessToken();
      if (liffAccessToken && selectedStoreId) {
        const tokenRes = await fetch("/api/line/issue-notification-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: selectedStoreId, liffAccessToken }),
        });
        if (tokenRes.ok) {
          const { notificationToken } = await tokenRes.json();
          if (notificationToken) {
            sessionStorage.setItem("patimoba_notification_token", notificationToken);
          }
        }
      }
    } catch {
      /* LIFF 未初期化の場合はスキップ */
    }

    window.location.href = data.redirectUrl;
  };

  const allComplete = numberComplete && expiryComplete && cvcComplete && name.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={points}
      />
      <div className="px-4 pt-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <StepProgress
        currentStep={4}
        steps={steps}
        maxWidthClassName="max-w-[1000px] mx-auto"
      />
      <div className="px-4 pb-10 max-w-[1000px] mx-auto">
        <div className="space-y-5 mt-4">
          {/* カード番号 */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-sm font-medium text-gray-800">カード番号</span>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <div
              id="payjp-card-number"
              className="border border-gray-300 rounded-lg px-3 py-3 bg-white min-h-[48px]"
            />
            {numberError && (
              <p className="text-xs text-red-500 mt-1">{numberError}</p>
            )}
          </div>

          {/* 有効期限 */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-sm font-medium text-gray-800">有効期限</span>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <div
              id="payjp-card-expiry"
              className="border border-gray-300 rounded-lg px-3 py-3 bg-white min-h-[48px] w-48"
            />
            {expiryError && (
              <p className="text-xs text-red-500 mt-1">{expiryError}</p>
            )}
          </div>

          {/* セキュリティーコード */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-sm font-medium text-gray-800">セキュリティーコード</span>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <div
              id="payjp-card-cvc"
              className="border border-gray-300 rounded-lg px-3 py-3 bg-white min-h-[48px] w-36"
            />
            {cvcError && (
              <p className="text-xs text-red-500 mt-1">{cvcError}</p>
            )}
          </div>

          {/* 名義人 */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-sm font-medium text-gray-800">名義人</span>
              <span className="text-xs text-red-500 font-bold">必須</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TARO YAMADA"
              autoComplete="cc-name"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-300"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-4 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !allComplete}
          className="w-full mt-8 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? "処理中..." : "決定する"}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3.5 h-3.5" />
          お客様の情報は暗号化で保護されています
        </p>
      </div>
    </div>
  );
}
