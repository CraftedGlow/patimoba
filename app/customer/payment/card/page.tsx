"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

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
    type: "card",
    options?: { style?: Record<string, unknown> }
  ): PayjpCardElement;
}
interface PayjpInstance {
  elements(): PayjpElements;
  createToken(
    element: PayjpCardElement,
    data?: {
      three_d_secure?: boolean;
      card?: { name?: string; phone?: string };
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

export default function CardAddPage() {
  const router = useRouter();
  const { profile, points, userId } = useCustomerContext();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardElementRef = useRef<PayjpCardElement | null>(null);
  const payjpRef = useRef<PayjpInstance | null>(null);
  const mountedRef = useRef(false);

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
      const cardElement = elements.create("card", {
        style: {
          base: { color: "#111827", fontSize: "16px" },
          invalid: { color: "#dc2626" },
        },
      });
      cardElement.mount("#payjp-card-element");
      cardElementRef.current = cardElement;

      cardElement.on("change", (e) => {
        setCardComplete(!!e.complete);
        setCardError(e.error?.message ?? null);
      });
    };
    document.body.appendChild(script);

    return () => {
      mountedRef.current = false;
      cardElementRef.current = null;
      payjpRef.current = null;
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = async () => {
    if (!cardElementRef.current || !payjpRef.current) return;
    if (!name.trim()) {
      setError("カード名義人を入力してください");
      return;
    }
    if (!phone.trim()) {
      setError("電話番号を入力してください");
      return;
    }
    if (!userId) {
      setError("ログイン情報が見つかりません。再ログインしてください。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await payjpRef.current.createToken(cardElementRef.current, {
      three_d_secure: true,
      card: { name: name.trim(), phone: toE164(phone) },
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

    window.location.href = data.redirectUrl;
  };

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
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold">クレジットカードの追加</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            カード情報を入力してください
          </p>
        </div>

        <div className="bg-gray-100 rounded-md px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-700">ご利用可能なカード</span>
          <div className="flex items-center gap-2">
            <span className="inline-block bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] font-bold text-blue-700">
              VISA
            </span>
            <span className="inline-block bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] font-bold">
              <span className="text-red-500">●</span>
              <span className="text-orange-400">●</span>
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード名義人（ローマ字）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TARO YAMADA"
              autoComplete="cc-name"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              電話番号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              autoComplete="tel"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード情報
            </label>
            <div
              id="payjp-card-element"
              className="border border-gray-300 rounded-md px-3 py-3 bg-white min-h-[48px]"
            />
            {cardError && (
              <p className="text-xs text-red-500 mt-1">{cardError}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-4 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !cardComplete}
          className="w-full mt-6 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 text-white font-bold py-3 rounded-md text-sm transition-colors"
        >
          {submitting ? "処理中..." : "カードを登録する"}
        </button>

        <p className="text-xs text-gray-600 text-center mt-4">
          ※カード情報は安全に処理されます。当サイトにカード番号は保存されません。
        </p>
      </div>
    </div>
  );
}
