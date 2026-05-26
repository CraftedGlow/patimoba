"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { getLiffId, parseLiffStateStoreId, saveLiffId } from "@/lib/get-liff-id";

export default function LiffLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const storeId = parseLiffStateStoreId();
        const liffId = await getLiffId(storeId);
        if (!liffId) {
          router.replace("/login");
          return;
        }
        saveLiffId(liffId);
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LineSpinner size={30} />
    </div>
  );
}
