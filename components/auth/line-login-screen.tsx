"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress !== 100) return;
    const t = setTimeout(() => {
      router.push(redirectTo);
    }, 800);
    return () => clearTimeout(t);
  }, [progress, redirectTo, router]);

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
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            LINEログイン中...
          </h2>

          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-3 shadow-inner">
            <motion.div
              className="h-full rounded-full bg-[#F9A825]"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.08 }}
            />
          </div>

          <p className="text-lg font-bold text-gray-900">{progress}%</p>
        </motion.div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="text-center pb-10 space-y-3"
      >
        <button
          type="button"
          className="text-sm text-blue-600 underline block mx-auto hover:text-blue-700"
        >
          利用規約を読む
        </button>
        <button
          type="button"
          className="text-sm text-blue-600 underline block mx-auto hover:text-blue-700"
        >
          プライバシーポリシーを読む
        </button>
        <button
          type="button"
          className="text-sm text-blue-600 underline block mx-auto hover:text-blue-700"
        >
          特定商取引法を読む
        </button>
      </motion.footer>
    </div>
  );
}
