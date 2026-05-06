"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TdsCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      console.log("[tds-callback] コールバックページ 開始");
      const customerId = sessionStorage.getItem("patimoba_customer_id");
      const userId = sessionStorage.getItem("patimoba_user_id");
      const returnPath =
        sessionStorage.getItem("patimoba_tds_return_path") ||
        "/customer/takeout/confirm";
      console.log("[tds-callback] customerId:", customerId, "userId:", userId, "returnPath:", returnPath);

      if (!customerId) {
        console.error("[tds-callback] customerId が sessionStorage に見つからない");
        setErrorMsg("セッション情報が見つかりません。最初からやり直してください。");
        return;
      }

      // 3DS 完了処理
      console.log("[tds-callback] tds-finish 呼び出し 開始");
      const res = await fetch("/api/payjp/tds-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const resData = await res.json();
      console.log("[tds-callback] tds-finish →", res.status, resData);

      if (!res.ok) {
        setErrorMsg(resData.error?.message ?? "3Dセキュア認証に失敗しました。もう一度お試しください。");
        return;
      }

      // PAY.JP 顧客 ID を users テーブルに保存
      if (userId) {
        console.log("[tds-callback] DB 保存 開始, userId:", userId, "customerId:", customerId);
        const { error: dbErr } = await supabase
          .from("users")
          .update({ customer_id: customerId })
          .eq("id", userId);
        console.log("[tds-callback] DB 保存 →", dbErr ?? "OK");
      }

      // sessionStorage クリーンアップ
      sessionStorage.setItem("patimoba_has_card", "1");
      sessionStorage.removeItem("patimoba_customer_id");
      sessionStorage.removeItem("patimoba_user_id");
      sessionStorage.removeItem("patimoba_tds_return_path");

      console.log("[tds-callback] 完了 → redirect:", returnPath);
      router.replace(returnPath);
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
