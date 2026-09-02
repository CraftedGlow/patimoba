"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { getLiffId, parseLiffStateStoreId, parseLiffStateCouponToken, saveLiffId } from "@/lib/get-liff-id";

export default function LiffLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const storeId = parseLiffStateStoreId();
      const couponToken = parseLiffStateCouponToken();
      if (couponToken) {
        try { sessionStorage.setItem("patimoba_pending_coupon_token", couponToken); } catch {}
      }
      const loginUrl = storeId ? `/login?storeId=${storeId}` : "/login";
      try {
        const liffId = await getLiffId(storeId);
        if (!liffId) {
          router.replace(loginUrl);
          return;
        }
        saveLiffId(liffId);
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          router.replace(loginUrl);
        }
      } catch {
        router.replace(loginUrl);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LineSpinner size={30} />
    </div>
  );
}
