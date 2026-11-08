"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth-fetch";

export default function TdsCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const customerId = sessionStorage.getItem("patimoba_customer_id");
      const userId = sessionStorage.getItem("patimoba_user_id");
      const returnPath =
        sessionStorage.getItem("patimoba_tds_return_path") ||
        "/customer/takeout/confirm";

      if (!customerId || !userId) {
        console.error("[tds-callback] customerId / userId が sessionStorage に見つからない");
        setErrorMsg("セッション情報が見つかりません。最初からやり直してください。");
        return;
      }

      // 3DS 完了処理（サーバー側で本人に登録済みの顧客であることを検証する。
      // customer_id の保存はサーバー側でのみ行うため、ここでは users を更新しない）
      const res = await authFetch("/api/payjp/tds-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, user_id: userId }),
      });
      const resData = await res.json();

      if (!res.ok) {
        setErrorMsg(resData.error?.message ?? "3Dセキュア認証に失敗しました。もう一度お試しください。");
        return;
      }

      // sessionStorage クリーンアップ
      sessionStorage.setItem("patimoba_has_card", "1");
      sessionStorage.removeItem("patimoba_customer_id");
      sessionStorage.removeItem("patimoba_user_id");
      sessionStorage.removeItem("patimoba_tds_return_path");

      router.replace(returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/customer/takeout/confirm");
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-sm text-red-500">{errorMsg}</p>
        <button
          onClick={() => { console.log("[tds-callback] カード登録に戻るボタン clicked"); router.replace("/customer/payment/card"); }}
          className="bg-amber-400 hover:bg-amber-500 text-white font-bold py-2.5 px-8 rounded-md text-sm"
        >
          カード登録に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-500">3Dセキュア認証を処理中...</p>
    </div>
  );
}
