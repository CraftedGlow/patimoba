"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CakeTab } from "@/components/store/register/cake-tab";
import { EcTab } from "@/components/store/register/ec-tab";

type TabId = "cake" | "ec";

const tabs: { id: TabId; label: string }[] = [
  { id: "cake", label: "ケーキ" },
  { id: "ec", label: "EC商品" },
];

export default function StoreRegisterPage() {
  const [activeTab, setActiveTab] = useState<TabId>("cake");

  return (
    <div className="p-6">
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-amber-400 text-amber-500"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
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
          {activeTab === "cake" ? <CakeTab /> : <EcTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
