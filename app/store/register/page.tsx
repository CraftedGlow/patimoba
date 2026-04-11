"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CakeTab } from "@/components/store/register/cake-tab";
import { CustomTab } from "@/components/store/register/custom-tab";
import { EcTab } from "@/components/store/register/ec-tab";

type MainTab = "ケーキ登録" | "カスタム" | "EC";

const tabs: MainTab[] = ["ケーキ登録", "カスタム", "EC"];

export default function StoreRegisterPage() {
  const [mainTab, setMainTab] = useState<MainTab>("ケーキ登録");

  return (
    <div className="p-6">
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`relative px-6 py-2.5 text-sm font-bold border border-b-0 rounded-t-lg transition-all duration-200 ${
              mainTab === tab
                ? "bg-white text-gray-900 border-gray-200 shadow-sm"
                : "bg-gray-50 text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab}
            {mainTab === tab && (
              <motion.div
                layoutId="tabIndicator"
                className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-amber-500"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mainTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {mainTab === "ケーキ登録" && <CakeTab />}
          {mainTab === "カスタム" && <CustomTab />}
          {mainTab === "EC" && <EcTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
