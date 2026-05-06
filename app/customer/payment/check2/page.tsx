"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Check2Content() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const tokenId = params.get("token_id");
    const userId = params.get("uid") || undefined;
    const label = params.get("label") ?? "";
    const returnPath = params.get("return");
    const isLiff = params.get("liff") === "1";

    if (!tokenId) { setStatus("error"); return; }

    (async () => {
      // tds_finish → customer 作成（verified）→ DB 保存
      const res = await fetch("/api/payjp/finalize-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_id: tokenId, user_id: userId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.error?.message ?? data.error ?? "カード登録に失敗しました");
        setStatus("error");
        return;
      }

      try {
        sessionStorage.setItem("patimoba_has_card", "1");
        sessionStorage.setItem("patimoba_card_label", decodeURIComponent(label));
        sessionStorage.setItem("patimoba_customer_id", data.customerId);
        sessionStorage.removeItem("patimoba_pending_3ds");
        sessionStorage.removeItem("patimoba_tds_return_path");
      } catch { /* ignore */ }

      setStatus("done");

      if (!isLiff && returnPath) {
        window.location.href = decodeURIComponent(returnPath);
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">3Dセキュア認証処理中...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-500">
          認証処理に失敗しました。<br />
          {errorMsg && <span className="block text-xs mt-1 text-gray-400">{errorMsg}</span>}
          LINEアプリに戻って再度お試しください。
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold mb-1">カード登録が完了しました</p>
        <p className="text-sm text-gray-500">LINEアプリに戻って注文を続けてください</p>
      </div>
      <a
        href="https://line.me/R/"
        className="bg-[#06C755] text-white font-bold py-3 px-8 rounded-full text-sm"
      >
        LINEに戻る
      </a>
    </div>
  );
}

export default function Check2Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <Check2Content />
    </Suspense>
  );
}
