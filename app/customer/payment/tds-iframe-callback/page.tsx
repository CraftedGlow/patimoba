"use client";

import { useEffect } from "react";

// PAY.JP iFrame型3DS のコールバックページ
// 3DS 認証完了後に PAY.JP がこのページへリダイレクトする。
// window.parent.postMessage で親フレーム（カード登録ページ）に完了を通知し、
// 親が iframe を閉じて処理を継続する。
export default function TdsIframeCallbackPage() {
  useEffect(() => {
    window.parent.postMessage({ type: "payjp_tds_complete" }, window.location.origin);
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
