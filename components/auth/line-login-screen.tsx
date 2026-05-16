"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";

type LineLoginScreenProps = {
  redirectTo: string;
  onBack?: () => void;
  logoClassName?: string;
  backLabel?: string;
};

export function LineLoginScreen({
  redirectTo,
  onBack,
  logoClassName = "h-14 w-auto",
  backLabel = "ログイン",
}: LineLoginScreenProps) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push(redirectTo);
    }, 3800);
    return () => clearTimeout(t);
  }, [redirectTo, router]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-[#FFF9C4] h-2.5 shrink-0" aria-hidden />

      {onBack ? (
        <div className="px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col items-center mb-10"
        >
          <Link href="/" className="mb-2">
            <Image
              src="/スクリーンショット_2026-04-09_14.49.59.png"
              alt="パティモバ"
              width={280}
              height={80}
              className={logoClassName}
              priority
            />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-full max-w-xs text-center"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-8">
            LINEログイン中...
          </h2>

          <div className="flex justify-center">
            <LineSpinner size={30} />
          </div>
        </motion.div>
      </div>

    </div>
  );
}
