"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CakeTab } from "@/components/store/register/cake-tab";
import { EcTab } from "@/components/store/register/ec-tab";
import { NoshiTab } from "@/components/store/register/noshi-tab";
import { MessagePlateTab } from "@/components/store/register/message-plate-tab";
import { CandleTab } from "@/components/store/register/candle-tab";

type TabId = "cake" | "ec" | "noshi" | "messagePlate" | "candle";

const tabs: { id: TabId; label: string; shortLabel: string }[] = [
  { id: "cake", label: "テイクアウト", shortLabel: "テイクアウト" },
  { id: "ec", label: "EC商品", shortLabel: "EC" },
  { id: "noshi", label: "のし管理", shortLabel: "のし" },
  { id: "messagePlate", label: "メッセージプレート管理", shortLabel: "プレート" },
  { id: "candle", label: "ろうそく管理", shortLabel: "ろうそく" },
];

export default function StoreRegisterPage() {
  const [activeTab, setActiveTab] = useState<TabId>("cake");

  return (
    <div className="p-4 lg:p-6">
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-amber-400 text-amber-500"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "cake" ? <CakeTab /> : activeTab === "ec" ? <EcTab /> : activeTab === "noshi" ? <NoshiTab /> : activeTab === "messagePlate" ? <MessagePlateTab /> : <CandleTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
