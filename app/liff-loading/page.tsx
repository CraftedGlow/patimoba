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
        router.replace(returnPath || fallbackPath);
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
