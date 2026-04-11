"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PatimobaInline } from "@/components/patimoba-logo";

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "ITが苦手でも使えますか？",
    a: (
      <>
        はい、問題ありません。初期設定（商品登録・予約設定・決済連携など）はすべて
        <PatimobaInline />
        のスタッフが代行します。導入後の操作もシンプルな管理画面に絞っており、スマホからでも確認・管理できます。不明点はいつでもサポートに相談いただけます。
      </>
    ),
  },
  {
    q: "本当に初期費用・月額費用が0円なのですか？",
    a: "はい、初期費用・月額固定費はゼロです。注文が成立したときにのみ、売上に対して3〜5%の手数料が発生する成果報酬型です。なお、各決済会社（クレジットカード等）への手数料は別途かかります。売上が上がった分だけコストが発生する仕組みなので、固定費のリスクがありません。",
  },
  {
    q: "導入までどのくらいの時間がかかりますか？",
    a: (
      <>
        最短2週間で受付を開始できます。商品登録・予約設定・決済連携などの初期設定はすべて
        <PatimobaInline />
        が行います。
      </>
    ),
  },
  {
    q: "テイクアウト以外の商品（ホールケーキ予約・EC・イベント受付）も対応できますか？",
    a: "はい。テイクアウト受付、ホールケーキ予約、焼き菓子ECの配送注文、クリスマスやバレンタインなどのイベント受付に対応しています。",
  },
  {
    q: "すでに別の予約システムを使っています。乗り換えは難しいですか？",
    a: (
      <>
        乗り換えもサポートしています。現在のシステムからのデータ移行や設定移行も
        <PatimobaInline />
        が代行しますので、お気軽にご相談ください。
      </>
    ),
  },
];

export function LpFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-xs font-medium text-amber-600 tracking-widest uppercase mb-2">
            FAQ
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            よくある質問
          </h2>
          <p className="mt-3 text-gray-500">
            導入前に気になることをまとめました。
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">
                  Q
                </span>
                <span className="text-sm font-bold text-gray-900 flex-1 pr-4">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-5 pb-4 pl-[52px]">
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {faq.a}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
