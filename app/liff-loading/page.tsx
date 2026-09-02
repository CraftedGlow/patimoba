"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { getLiffId, getLiffStoreInfo, parseLiffStateStoreId, parseLiffStateCouponToken, saveLiffId } from "@/lib/get-liff-id";
import { completeLiffLogin } from "@/lib/liff-login";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp";

export default function LiffLoadingPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  useEffect(() => {
    (async () => {
      const storeId = parseLiffStateStoreId() ?? getLiffStoreInfo()?.storeId ?? null;
      const couponToken = parseLiffStateCouponToken();
      if (couponToken) {
        try { sessionStorage.setItem("patimoba_pending_coupon_token", couponToken); } catch {}
      }
      const loginUrl = storeId ? `/login?storeId=${storeId}` : "/login";
      const fallbackPath = storeId ? `/customer/takeout/store/${storeId}` : "/customer/takeout";

      fetch("/api/debug/liff-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "app/liff-loading:entry",
          url: window.location.href,
          hasPendingCouponToken: !!sessionStorage.getItem("patimoba_pending_coupon_token"),
          note: `storeId=${storeId}`,
        }),
      }).catch(() => {});

      try {
        const liffId = await getLiffId(storeId);
        if (!liffId) {
          router.replace(loginUrl);
          return;
        }
        saveLiffId(liffId);

        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        setUser(null);

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          router.replace(loginUrl);
          return;
        }

        try { sessionStorage.setItem("liff_return_path", fallbackPath); } catch {}
        const { authUser, returnPath } = await completeLiffLogin(liff);
        setUser(authUser);
        try { sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString()); } catch {}
        // liff.init() が window.location を直接書き換えるため、Next.jsのrouter.replace()だと
        // 遷移が反映されないことがある。確実に遷移させるため window.location.replace() を使う。
        window.location.replace(returnPath || fallbackPath);
      } catch {
        router.replace(loginUrl);
      }
    })();
  }, [router, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LineSpinner size={30} />
    </div>
  );
}
