"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

function TokushoContent() {
  const params = useSearchParams();
  const router = useRouter();
  const storeId = params.get("store");

  const [storeName, setStoreName] = useState("");
  const [tokushoText, setTokushoText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("name, tokusho_text")
        .eq("id", storeId)
        .maybeSingle();
      setStoreName(data?.name ?? "");
      setTokushoText(data?.tokusho_text ?? null);
      setLoading(false);
    })();
  }, [storeId]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#ffff9d] px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-yellow-200 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <span className="font-bold text-gray-900 text-sm truncate">
          {storeName || "特定商取引法に基づく表記"}
        </span>
      </header>

      <div className="px-5 py-6 md:max-w-2xl md:mx-auto">
        <h1 className="text-base font-bold text-gray-900 mb-4">
          特定商取引法に基づく表記
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tokushoText ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {tokushoText}
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            特定商取引法に基づく表記は準備中です。詳しくは店舗までお問い合わせください。
          </p>
        )}
      </div>
    </div>
  );
}

export default function TokushoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TokushoContent />
    </Suspense>
  );
}
