/** DB `stores.plan` と管理画面で使うスラッグ（英小文字） */
export type StorePlanSlug = "light" | "standard" | "premium";

export const STORE_PLAN_SLUGS: StorePlanSlug[] = ["light", "standard", "premium"];

export const PLAN_OPTIONS: {
  slug: StorePlanSlug;
  label: string;
  priceYen: number;
  orderFeePercent: number;
  paymentFeePercent: number;
  accentClass: string;
  badge?: string;
  features: string[];
}[] = [
  {
    slug: "light",
    label: "ライト",
    priceYen: 0,
    orderFeePercent: 7,
    paymentFeePercent: 3.3,
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
    orderFeePercent: 3,
    paymentFeePercent: 3.3,
    accentClass: "text-yellow-800",
    features: [
      "全機能が使える（レポート除く）",
      "顧客管理・LINE連携",
      "予約・注文・EC・配達・のし管理",
    ],
  },
  {
    slug: "premium",
    label: "プレミアム",
    priceYen: 19800,
    orderFeePercent: 1,
    paymentFeePercent: 2.78,
    badge: "おすすめ",
    accentClass: "text-amber-800",
    features: [
      "スタンダードの全機能",
      "詳細レポート・売上分析",
      "決済手数料が最安",
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
  if (n === "premium") return 198_000;
  if (n === "standard") return 98_000;
  return 0;
}

/** 店舗一覧の合計MRR（円・月）。 */
export function totalMrrYen(stores: { plan?: string | null }[]): number {
  return stores.reduce((sum, s) => sum + mrrYenForStorePlan(s.plan), 0);
}

/** プラン別の配色（バッジ・グラフ共通）。 */
export const PLAN_COLORS: Record<StorePlanSlug, string> = {
  light: "#9CA3AF",
  standard: "#FBBF24",
  premium: "#F59E0B",
};
