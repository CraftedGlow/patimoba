"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { completeLiffLogin } from "@/lib/liff-login";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { getLiffId, parseLiffStateStoreId } from "@/lib/get-liff-id";

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp"

export default function Home() {
  const router = useRouter();
  const { setUser } = useAuth();

  const handleLiffCallback = useCallback(async (liffId: string, storeId?: string | null) => {
    if (!liffId) {
      router.replace(storeId ? `/login?storeId=${storeId}` : "/login");
      return;
    }

    // 毎回フレッシュなLINEプロフィールを取得するためキャッシュをクリア
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setUser(null)

    try {
      const liff = (await import("@line/liff")).default;
      await liff.init({ liffId });

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
          router.replace(returnPath || redirectedPath);
        } else {
          router.replace(storeId ? `/login?storeId=${storeId}` : "/login");
        }
        return;
      }

      if (liff.isLoggedIn()) {
        const { authUser, returnPath } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        router.replace(returnPath || "/customer/takeout");
      } else {
        router.replace(storeId ? `/login?storeId=${storeId}` : "/login");
      }
    } catch {
      router.replace(storeId ? `/login?storeId=${storeId}` : "/login");
    }
  }, [router, setUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // LIFF 認証コールバック or liff.state によるパス転送でなければ /login へ
    if (!params.has("code") && !params.has("liffClientId") && !params.has("liff.state")) {
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
          router.replace(pathOnly);
          return;
        }
      }

      const storeId = parseLiffStateStoreId();
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
