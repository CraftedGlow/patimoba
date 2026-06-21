"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Save, CheckCircle2 } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { motion } from "framer-motion";

type Tab = "terms" | "privacy";

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("terms");
  const [termsText, setTermsText] = useState("");
  const [privacyText, setPrivacyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["terms", "privacy"]);
      if (data) {
        for (const row of data) {
          if (row.key === "terms") setTermsText(row.value);
          if (row.key === "privacy") setPrivacyText(row.value);
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const key = activeTab;
    const value = activeTab === "terms" ? termsText : privacyText;
    await supabase
      .from("platform_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const tabLabel = activeTab === "terms" ? "利用規約" : "プライバシーポリシー";
  const text = activeTab === "terms" ? termsText : privacyText;
  const setText = activeTab === "terms" ? setTermsText : setPrivacyText;

  return (
    <>
      <header className="bg-[#FFF9C4] px-4 sm:px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">規約・ポリシー管理</h1>
          <p className="text-xs text-gray-600">利用規約・プライバシーポリシーの編集</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? (
            <LineSpinner size={16} />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "保存しました" : "保存する"}
        </motion.button>
      </header>

      <div className="p-4 sm:p-6">
        {/* タブ */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          {(["terms", "privacy"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSaved(false); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "terms" ? "利用規約" : "プライバシーポリシー"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LineSpinner size={24} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">{tabLabel}</p>
              <p className="text-xs text-gray-600">
                公開URL: /customer/{activeTab === "terms" ? "terms" : "privacy"}
              </p>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-[60vh] p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none font-mono"
              placeholder={`${tabLabel}の内容を入力してください`}
            />
          </div>
        )}
      </div>
    </>
  );
}
