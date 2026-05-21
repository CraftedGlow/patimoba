"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[90] p-8 text-center w-[90%] max-w-sm"
          >
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center animate-bounce">
                <span className="text-3xl">🛎️</span>
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
        </>
      )}
    </AnimatePresence>
  );
}
