"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const sections = [
  {
    title: "第1条（取得する情報の範囲）",
    content:
      "当サービスは、LINE連携や注文システムの運営にあたり、以下の情報を取得する場合があります。\n\n・氏名\n・電話番号\n・メールアドレス\n・住所\n・LINEアカウントに紐づくユーザーID\n・LINEアカウント名\n・LINEのアイコン\n・お気に入り店舗情報\n・注文履歴\n・配送・受取希望日時\n・記念日などの登録情報\n・LINEサービスメッセージの受信に関する同意状況\n・LINEミニアプリ利用時の友だち追加オプションへの同意状況",
  },
  {
    title: "第2条〜第4条（個人情報の利用・管理）",
    content:
      "取得した個人情報は、本サービスの提供・改善・サポート対応・通知配信等の目的に限り利用します。ユーザーの同意なく第三者へ提供することはありません（法令に基づく場合を除く）。Cookieを利用する場合がありますが、ブラウザ設定により無効にすることも可能です（一部機能が利用できなくなる場合があります）。",
  },
  {
    title: "第5条（個人情報の安全管理）",
    content:
      "運営者は個人情報の漏洩・滅失・毀損の防止のため以下の措置を講じています。\n\n・アクセス権限の制御・通信の暗号化（SSL/TLS）\n・定期的なバックアップ・ソフトウェア更新\n・業務委託先への監督と契約管理",
  },
  {
    title: "第6条（開示・訂正・削除の請求）",
    content:
      "ユーザーは自己に関する個人情報の開示・訂正・利用停止・削除等を希望される場合、以下の連絡先までご連絡ください。本人確認のうえ法令に基づき誠実に対応いたします。なお開示請求に手数料はかかりません。\n\nメールアドレス：info@craftedglow-j.com\nお問い合わせフォーム：https://patisseriemobile.com/#form",
  },
  {
    title: "第7条（ポリシーの改訂）",
    content:
      "本ポリシーの内容は必要に応じて変更することがあります。改定後のポリシーは本サイト上での掲示をもって効力を生じるものとします。重要な変更の場合は当サービス上で事前に通知します。",
  },
  {
    title: "第8条（運営者情報）",
    content:
      "運営者名：Crafted Glow株式会社（代表取締役：神田 丈）\n所在地：〒879-7411 大分県豊後大野市千歳町柴山1494-1\nメールアドレス：info@craftedglow-j.com\nお問い合わせフォーム：https://patisseriemobile.com/#form",
  },
  {
    title: "第9条（決済情報の取扱い）",
    content:
      "当サービスにおける決済処理は、PAY株式会社が提供する安全な決済システム（Pay.jp）を利用して行われます。運営者はユーザーのクレジットカード番号・セキュリティコード等の決済情報を保持しません。決済処理はSSL/TLSによる暗号化通信を用いて行われます。決済に関するお問い合わせはinfo@craftedglow-j.comまでご連絡ください。",
  },
];

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#ffff9d] px-4 py-3 flex items-center sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-black/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <h1 className="ml-3 font-bold text-gray-900 text-base">パティモバ プライバシーポリシー</h1>
      </header>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <p className="text-xs text-gray-500 mb-6">最終改定日：2025年5月14日</p>

        <p className="text-sm text-gray-700 leading-relaxed mb-8">
          Crafted Glow株式会社（以下「運営者」）は、パティモバ（以下「当サービス」）において、ユーザーの個人情報を適切に取り扱うことが重要な責務であると認識し、以下のとおりプライバシーポリシーを定め、これを遵守します。
        </p>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-sm font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{s.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Crafted Glow株式会社</p>
        </div>
      </div>
    </div>
  );
}
