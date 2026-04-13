"use client";

import { motion } from "framer-motion";
import { CakeTab } from "@/components/store/register/cake-tab";

export default function StoreRegisterPage() {
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <CakeTab />
      </motion.div>
    </div>
  );
}
