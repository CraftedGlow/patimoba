"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { supabase } from "@/lib/supabase";

interface PlatformLegalPageProps {
  settingsKey: string;
  title: string;
}

export function PlatformLegalPage({ settingsKey, title }: PlatformLegalPageProps) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", settingsKey)
      .maybeSingle()
      .then(({ data }) => {
        setText(data?.value ?? null);
        setLoading(false);
      });
  }, [settingsKey]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#ffff9d] px-4 py-3 flex items-center sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <h1 className="ml-3 font-bold text-gray-900 text-base">{title}</h1>
      </header>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <LineSpinner size={24} />
          </div>
        ) : text ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-sm text-gray-600 text-center py-20">内容を準備中です。</p>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-600">Crafted Glow株式会社</p>
        </div>
      </div>
    </div>
  );
}
