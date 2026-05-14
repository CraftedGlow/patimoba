"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useCustomerContext } from "@/lib/customer-context";

type ModalType = "privacy" | "terms" | "tokusho";

const PRIVACY_POLICY = `■ 個人情報の取得について
当サービス（パティモバ）は、サービス提供にあたり、お客様の氏名・電話番号・メールアドレス・住所・購入履歴などの個人情報を取得します。

■ 利用目的
取得した個人情報は、以下の目的に限り利用します。
・ご注文の受付・確認・配送
・お問い合わせへの対応
・サービス改善・統計分析（個人を特定しない形で利用）

■ 第三者への提供
法令に基づく場合を除き、お客様の同意なく第三者に個人情報を提供することはありません。

■ 情報の管理
個人情報は適切なセキュリティ対策を講じて管理し、不正アクセス・漏洩・紛失の防止に努めます。

■ お問い合わせ
個人情報の開示・訂正・削除のご要望は、各店舗またはパティモバサポートまでご連絡ください。`;

const TERMS = `■ 利用規約

第1条（適用）
本規約は、パティモバが提供するサービス（以下「本サービス」）の利用条件を定めるものです。

第2条（利用登録）
本サービスの利用にあたり、お客様は本規約に同意するものとします。

第3条（禁止事項）
以下の行為を禁止します。
・法令または公序良俗に反する行為
・他のユーザーへの迷惑行為
・サービスの運営を妨害する行為
・虚偽の情報を登録する行為

第4条（サービスの変更・停止）
当社は、お客様への事前通知なくサービスの内容を変更または停止することがあります。

第5条（免責事項）
当社は、本サービスに関してお客様に生じた損害について、当社の故意または重過失による場合を除き、責任を負いません。

第6条（規約の変更）
当社は必要に応じて本規約を変更することがあります。変更後の規約はサービス上に掲示した時点で効力を生じるものとします。`;

export function LegalFooter() {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const { selectedStoreId } = useCustomerContext();
  const router = useRouter();

  const openModal = (type: ModalType) => {
    if (type === "tokusho") {
      router.push(`/customer/tokusho?store=${selectedStoreId}`);
      return;
    }
    setActiveModal(type);
  };

  const titles: Record<ModalType, string> = {
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    tokusho: "特定商取引法に基づく表記",
  };

  const getContent = () => {
    switch (activeModal) {
      case "privacy": return PRIVACY_POLICY;
      case "terms": return TERMS;
default: return "";
    }
  };

  return (
    <>
      <footer className="border-t border-gray-100 py-5 px-4 flex flex-col items-center gap-2.5">
        {(["terms", "privacy", ...(selectedStoreId ? ["tokusho"] : [])] as ModalType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => openModal(type)}
            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors"
          >
            {titles[type]}を読む
          </button>
        ))}
      </footer>

      <AnimatePresence>
        {activeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[80]"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-x-4 top-[8%] bottom-[8%] bg-white rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <h2 className="text-sm font-bold text-gray-900">{titles[activeModal]}</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {getContent()}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
