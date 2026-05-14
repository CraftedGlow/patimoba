"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PrivacyPage() {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "privacy")
      .maybeSingle()
      .then(({ data }) => {
        setText(data?.value ?? null);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#ffff9d] px-4 py-3 flex items-center sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <h1 className="ml-3 font-bold text-gray-900 text-base">パティモバ プライバシーポリシー</h1>
      </header>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : text ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-sm text-gray-400 text-center py-20">内容を準備中です。</p>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Crafted Glow株式会社</p>
        </div>
      </div>
    </div>
  );
}
