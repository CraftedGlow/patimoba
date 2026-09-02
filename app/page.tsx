"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { completeLiffLogin } from "@/lib/liff-login";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { getLiffId, parseLiffStateStoreId, parseLiffStateCouponToken } from "@/lib/get-liff-id";

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp"

export default function Home() {
  const router = useRouter();
  const { setUser } = useAuth();

  const handleLiffCallback = useCallback(async (liffId: string, storeId?: string | null) => {
    if (!liffId) {
      router.replace("/customer/login");
      return;
    }

    // 毎回フレッシュなLINEプロフィールを取得するためキャッシュをクリア
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setUser(null)

    try {
      const liff = (await import("@line/liff")).default;

      // liff.init() が解決も拒否もせずハングするケースが確認されたため、
      // 一定時間で強制的にタイムアウトさせてフォールバックできるようにする
      await Promise.race([
        liff.init({ liffId }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("liff_init_timeout")), 8000)
        ),
      ]);

      // LIFF SDKがURLを書き換えた後のパスを取得
      // /customer/takeout/[uuid] 形式は /customer/takeout/store/[uuid] に補正
      let redirectedPath = window.location.pathname;
      const missingStorePath = redirectedPath.match(/^(\/customer\/takeout\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
      if (missingStorePath) {
        redirectedPath = `${missingStorePath[1]}store/${missingStorePath[2]}`;
      }

      if (redirectedPath && redirectedPath !== "/") {
        if (liff.isLoggedIn()) {
          sessionStorage.setItem("liff_return_path", redirectedPath);
          const { authUser, returnPath } = await completeLiffLogin(liff);
          setUser(authUser);
          sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
          // LIFF SDKが liff.init() 内で window.location を直接書き換えているため、
          // Next.jsのrouter.replace()だとルーター内部状態とのズレで遷移が反映されないことがある。
          // ここでの最終遷移は window.location.replace() で確実に行う。
          window.location.replace(returnPath || redirectedPath);
        } else {
          // liff.login() をここで直接呼ぶとuseEffect起点のため一部端末・タイミングで
          // 不安定になることが確認できたため、ユーザー操作起点で確実に動く
          // /customer/login の「LINEでログイン」ボタン経由に統一する
          sessionStorage.setItem("liff_return_path", redirectedPath);
          router.replace("/customer/login");
        }
        return;
      }

      if (liff.isLoggedIn()) {
        const { authUser, returnPath } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        window.location.replace(returnPath || "/customer/takeout");
      } else {
        router.replace("/customer/login");
      }
    } catch {
      router.replace("/customer/login");
    }
  }, [router, setUser]);

  useEffect(() => {
    // LINE側が同じリンクを短時間に複数回リロードする挙動が確認されている。
    // 先行の読み込みで既にクーポンを獲得済み（獲得画面がまだ未表示）なら、
    // liff.init() からのログインをやり直さず即座に獲得画面へ遷移する。
    // ここで早期に確定させることで、次のリロードに割り込まれる前に遷移を完了させる。
    if (sessionStorage.getItem("patimoba_claimed_coupon")) {
      window.location.replace("/customer/coupons/claimed");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    // LIFF 認証コールバック / liff.state によるパス転送 / miniapp.line.me の
    // シンプルなクエリ形式(?coupon=)でなければ /login へ
    if (!params.has("code") && !params.has("liffClientId") && !params.has("liff.state") && !params.has("coupon")) {
      router.replace("/login");
      return;
    }

    (async () => {
      // 認証不要なパスは直接遷移
      const liffState = params.get("liff.state");
      if (liffState) {
        const decoded = decodeURIComponent(liffState);
        const pathOnly = decoded.split("?")[0];
        if (pathOnly.startsWith("/customer/orders/")) {
          window.location.replace(pathOnly);
          return;
        }
      }

      // miniapp.line.me/{liffId}?coupon=xxx&store=xxx 形式は追加パスが無いため
      // liff.state に包まれずクエリがそのままエンドポイントに渡ってくる
      const couponToken = params.get("coupon") || parseLiffStateCouponToken();
      if (couponToken) {
        try { sessionStorage.setItem("patimoba_pending_coupon_token", couponToken); } catch {}
      }

      const storeId = params.get("store") || parseLiffStateStoreId();
      const liffId = await getLiffId(storeId);
      handleLiffCallback(liffId, storeId);
    })();
  }, [handleLiffCallback, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LineSpinner size={30} />
    </div>
  );
}
