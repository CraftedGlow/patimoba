/** DB `stores.plan` と管理画面で使うスラッグ（英小文字） */
export type StorePlanSlug = "light" | "standard" | "premium";

export const STORE_PLAN_SLUGS: StorePlanSlug[] = ["light", "standard", "premium"];

export const PLAN_OPTIONS: {
  slug: StorePlanSlug;
  label: string;
  priceYen: number;
  accentClass: string;
  badge?: string;
  features: string[];
}[] = [
  {
    slug: "light",
    label: "ライト",
    priceYen: 0,
    accentClass: "text-gray-800",
    features: [
      "予約・注文の基本管理",
      "注文一覧・ステータス更新",
      "メール通知（基本）",
    ],
  },
  {
    slug: "standard",
    label: "スタンダード",
    priceYen: 9800,
    accentClass: "text-yellow-800",
    features: [
      "ライトの全機能",
      "顧客管理・LINE連携",
      "売上レポート（標準）",
    ],
  },
  {
    slug: "premium",
    label: "プレミアム",
    priceYen: 15000,
    badge: "おすすめ",
    accentClass: "text-amber-800",
    features: [
      "スタンダードの全機能",
      "記念日通知・詳細レポート",
      "カスタムケーキ・焼き菓子EC・配達",
      "優先サポート",
    ],
  },
];

export interface PlanAddon {
  id: string;
  label: string;
  priceYen: number;
  description: string;
}

export const PLAN_ADDONS: PlanAddon[] = [
  { id: "ec", label: "ECショップ機能", priceYen: 3000, description: "焼き菓子・ギフトのオンライン販売" },
  { id: "delivery", label: "配達機能", priceYen: 2000, description: "デリバリー対応・配達先管理" },
  { id: "anniversary", label: "記念日自動通知", priceYen: 1500, description: "顧客の記念日をLINEで自動通知" },
  { id: "noshi", label: "のし・包装管理", priceYen: 1000, description: "のしや包装オプションの設定・管理" },
  { id: "multi_staff", label: "複数スタッフ管理", priceYen: 2000, description: "スタッフ別権限・サブアカウント管理" },
];

/** レガシー値 `free` はライトに読み替え */
export function normalizeStorePlan(raw: string | null | undefined): StorePlanSlug {
  if (raw === "premium") return "premium";
  if (raw === "standard") return "standard";
  if (raw === "light" || raw === "free") return "light";
  return "light";
}

/** 管理画面のMRR試算（円・月）。表示用の目安。 */
export function mrrYenForStorePlan(plan: string | null | undefined): number {
  const n = normalizeStorePlan(plan);
  if (n === "premium") return 150_000;
  if (n === "standard") return 98_000;
  return 0;
}
