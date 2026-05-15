"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { completeLiffLogin } from "@/lib/liff-login";
import { LpHeader } from "@/components/lp/lp-header";
import { LpHero } from "@/components/lp/lp-hero";
import { LpTwoValues } from "@/components/lp/lp-two-values";
import { LpCustomerVoice } from "@/components/lp/lp-customer-voice";
import { LpStorePain } from "@/components/lp/lp-store-pain";
import { LpCapabilities } from "@/components/lp/lp-capabilities";
import { LpStoreTestimonials } from "@/components/lp/lp-store-testimonials";
import { LpPricing } from "@/components/lp/lp-pricing";
import { LpTimeline } from "@/components/lp/lp-timeline";
import { LpCeoMessage } from "@/components/lp/lp-ceo-message";
import { LpFaq } from "@/components/lp/lp-faq";
import { LpContact } from "@/components/lp/lp-contact";
import { LpFooter } from "@/components/lp/lp-footer";

export default function Home() {
  const router = useRouter();
  const [isLiffCallback, setIsLiffCallback] = useState(false);

  const handleLiffCallback = useCallback(async (liffId: string) => {
    try {
      const liff = (await import("@line/liff")).default;
      await liff.init({ liffId });

      // liff.init() が liff.state を処理してパスを書き換えた場合はそこへ遷移
      const redirectedPath = window.location.pathname;
      if (redirectedPath && redirectedPath !== "/") {
        router.replace(redirectedPath + window.location.search);
        return;
      }

      if (liff.isLoggedIn()) {
        await completeLiffLogin(liff, (path) => router.replace(path));
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;
    const params = new URLSearchParams(window.location.search);
    // LIFF 認証コールバック or liff.state によるパス転送
    if (!params.has("code") && !params.has("liffClientId") && !params.has("liff.state")) return;

    setIsLiffCallback(true);
    handleLiffCallback(liffId);
  }, [handleLiffCallback]);

  if (isLiffCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <LpHeader />
      <LpHero />
      <LpTwoValues />
      <LpCustomerVoice />
      <LpStorePain />
      <LpCapabilities />
      <LpStoreTestimonials />
      <LpPricing />
      <LpTimeline />
      <LpCeoMessage />
      <LpFaq />
      <LpContact />
      <LpFooter />
    </div>
  );
}
