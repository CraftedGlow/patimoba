"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";

export default function LiffLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        // liff.init() が liff.state のパスへ history.replaceState するので
        // Next.js が /login?liff.hback=2 へ遷移し、/login 側で認証を完了させる
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
