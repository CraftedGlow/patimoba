"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { useStoreContext } from "@/lib/store-context";
import { useNewOrderAlert } from "@/hooks/use-new-order-alert";

export function NewOrderAlert() {
  const router = useRouter();
  const { storeId } = useStoreContext();
  const { showAlert, dismiss } = useNewOrderAlert(storeId);

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismiss();
    router.push("/store/dashboard");
  };

  return (
    <AnimatePresence>
      {showAlert && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[80]"
          />
          <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto bg-white rounded-2xl shadow-2xl p-8 text-center w-[90%] max-w-sm"
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center animate-bounce">
                  <Bell className="w-8 h-8 text-amber-500" />
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-2">新規注文が入りました</p>
              <p className="text-sm text-gray-500 mb-6">当日受取の注文です</p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base transition-colors"
              >
                確認する
              </motion.button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
