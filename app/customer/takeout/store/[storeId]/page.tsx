"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarDays, MapPin, X } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useAuth, STORAGE_KEY } from "@/lib/auth-context";
import { completeLiffLogin } from "@/lib/liff-login";

const LIFF_LOGIN_TIMESTAMP_KEY = "liff_login_timestamp";
import { useCustomerContext } from "@/lib/customer-context";
import { toUIStore } from "@/lib/types";
import type { Store } from "@/lib/types";

const TERMS_SECTIONS = [
  { title: "第1条（適用）", body: "本規約は、ユーザーと運営者との間に成立する、当サービスの利用に関わる一切の関係に適用されます。" },
  { title: "第2条（定義）", body: "「ユーザー」とは、当サービスを利用するすべての方をいいます。\n「出店店舗」とは、当サービス上で商品・サービスを販売する飲食・物販事業者をいいます。\n「顧客」とは、出店店舗の商品を注文するエンドユーザーをいいます。\n「運営者」とは、Crafted Glow株式会社をいいます。" },
  { title: "第3条（サービス内容）", body: "当サービスは、LINE連携を用いた店舗向けのネット注文・販売促進を行うプラットフォームです。顧客は以下のいずれかの方法から注文できます。\n\n・パティモバ公式LINEのメニューから店舗を選択して注文する\n・各出店店舗のLINE公式アカウントから直接注文する（その店舗のメニューがそのまま表示されます）\n\n注文後は以下のいずれかの方法で商品を受け取ることができます。\n\n・店舗での受け取り（テイクアウト）\n・全国配送（スタンダード・プロプランの店舗のみ）\n・一部店舗が提供する配達サービス\n\n出店店舗は、商品登録・営業日設定等の機能を利用し、当サービスを通じて入った注文の対応を行います。" },
  { title: "第4条（利用環境の整備）", body: "ユーザーは、当サービスを利用するために必要な通信機器・インターネット接続・LINEアカウント等を自己の責任と負担において準備・維持するものとします。" },
  { title: "第5条（禁止事項）", body: "ユーザーは以下の行為をしてはなりません。\n\n・虚偽の情報を提供する行為\n・不正アクセスやシステム妨害行為\n・第三者の権利侵害行為\n・法令や公序良俗に違反する行為\n・他人になりすます行為\n・サービスの信用を毀損する行為\n・当サービスの運営を妨害する行為\n・その他運営者が不適切と判断する行為" },
  { title: "第6条（注文・支払い・キャンセル）", body: "顧客は、パティモバ公式LINEまたは各出店店舗のLINE公式アカウントから商品を選択し、日時・商品を指定して注文を行います。支払方法はクレジットカード決済（Pay.jpを使用）または店舗における現地決済（現金・店舗が指定する方法）です。\n\nキャンセル・返金をご希望の場合は、各出店店舗に直接お問い合わせください。店舗がキャンセルを承認した場合、クレジットカード決済の場合は運営者がPay.jpを通じてご注文時のクレジットカードへ返金処理を行います。現地決済（現金等）の場合は店舗にて対応します。返金までに3〜10営業日かかる場合があります。\n\nなお以下の場合は運営者が対応し、全額返金します。\n\n・注文商品と異なる商品が届いた場合\n・商品が破損・劣化していた場合\n・著しい品質不良が確認された場合\n\n該当する場合は商品受け取り後24時間以内にinfo@craftedglow-j.comまでご連絡ください。" },
  { title: "第7条（特定商取引法に基づく表記）", body: "各出店店舗が販売者となる商品については、各店舗が定める特定商取引法に基づく表記が適用されます。各店舗の特定商取引法表記は、各店舗のページに掲示します。" },
  { title: "第8条（免責事項）", body: "商品の製造・提供・配送は出店店舗が行います。運営者は注文・LINE配信のプラットフォームとしての役割を担いますが、顧客からのトラブル申告については運営者が合理的な範囲で対応します。\n\nシステム障害や通信エラー等によりサービスの提供が一時的に中断される場合がありますが、運営者はこれに対する直接損害を超える責任は負いません。地震・洪水・火災その他の天災地変、停電、通信回線の障害、戦争、テロ、法令の改廃その他の不可抗力により生じた損害についても、運営者は合理的な範囲を超えた責任を負いません。" },
  { title: "第9条（個人情報の取扱い）", body: "ユーザーの個人情報は、当サービスのプライバシーポリシーに則り適切に管理・運用します。" },
  { title: "第10条（知的財産権）", body: "当サービスに関する一切のコンテンツ（ロゴ・デザイン・システム等）に関する著作権その他の知的財産権は、運営者または正当な権利者に帰属します。ユーザーは、当サービスのコンテンツを無断で利用（複製・転用・配布など）することはできません。" },
  { title: "第11条（本規約の変更）", body: "運営者は必要と判断した場合、本規約を変更できるものとします。変更内容がユーザーに重大な影響を与える場合は当サービス上で事前に通知します。変更後にサービスを利用した場合、変更内容に同意したものとみなされます。" },
  { title: "第12条（準拠法及び裁判管轄）", body: "本規約は日本法を準拠法とし、紛争が生じた場合には大分地方裁判所を第一審の専属的合意管轄裁判所とします。" },
];

const PRIVACY_SECTIONS = [
  { title: "第1条（取得する情報の範囲）", body: "当サービスは、LINE連携や注文システムの運営にあたり、以下の情報を取得する場合があります。\n\n・氏名\n・電話番号\n・メールアドレス\n・住所\n・LINEアカウントに紐づくユーザーID\n・LINEアカウント名\n・LINEのアイコン\n・お気に入り店舗情報\n・注文履歴\n・配送・受取希望日時\n・記念日などの登録情報\n・LINEサービスメッセージの受信に関する同意状況\n・LINEミニアプリ利用時の友だち追加オプションへの同意状況" },
  { title: "第2条〜第4条（個人情報の利用・管理）", body: "取得した個人情報は、本サービスの提供・改善・サポート対応・通知配信等の目的に限り利用します。ユーザーの同意なく第三者へ提供することはありません（法令に基づく場合を除く）。Cookieを利用する場合がありますが、ブラウザ設定により無効にすることも可能です（一部機能が利用できなくなる場合があります）。" },
  { title: "第5条（個人情報の安全管理）", body: "運営者は個人情報の漏洩・滅失・毀損の防止のため以下の措置を講じています。\n\n・アクセス権限の制御・通信の暗号化（SSL/TLS）\n・定期的なバックアップ・ソフトウェア更新\n・業務委託先への監督と契約管理" },
  { title: "第6条（開示・訂正・削除の請求）", body: "ユーザーは自己に関する個人情報の開示・訂正・利用停止・削除等を希望される場合、以下の連絡先までご連絡ください。本人確認のうえ法令に基づき誠実に対応いたします。なお開示請求に手数料はかかりません。\n\nメールアドレス：info@craftedglow-j.com\nお問い合わせフォーム：https://patisseriemobile.com/#form" },
  { title: "第7条（ポリシーの改訂）", body: "本ポリシーの内容は必要に応じて変更することがあります。改定後のポリシーは本サイト上での掲示をもって効力を生じるものとします。重要な変更の場合は当サービス上で事前に通知します。" },
  { title: "第8条（運営者情報）", body: "運営者名：Crafted Glow株式会社（代表取締役：神田 丈）\n所在地：〒879-7411 大分県豊後大野市千歳町柴山1494-1\nメールアドレス：info@craftedglow-j.com\nお問い合わせフォーム：https://patisseriemobile.com/#form" },
  { title: "第9条（決済情報の取扱い）", body: "当サービスにおける決済処理は、PAY株式会社が提供する安全な決済システム（Pay.jp）を利用して行われます。運営者はユーザーのクレジットカード番号・セキュリティコード等の決済情報を保持しません。決済処理はSSL/TLSによる暗号化通信を用いて行われます。決済に関するお問い合わせはinfo@craftedglow-j.comまでご連絡ください。" },
];

// ── 当日受付チェック (order-type-modal と同ロジック) ─────────────────────

function formatTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

interface SameDayStatus {
  available: boolean;
  reason: "ok" | "closed_today" | "outside_hours" | "no_schedule";
  acceptStart: string | null;
  acceptEnd: string | null;
}

function minutesToTimeStr(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function checkTimeWindow(
  cutoffMin: number,
  openTime: string | null,
  closeTime: string | null,
  now: Date,
  setStatus: (s: SameDayStatus) => void
) {
  if (!openTime || !closeTime) {
    setStatus({ available: false, reason: "no_schedule", acceptStart: null, acceptEnd: null });
    return;
  }
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  let openMinutes = oh * 60 + om;
  let closeMinutes = ch * 60 + cm;
  if (closeMinutes <= openMinutes) closeMinutes += 1440;
  const acceptEndMinutes = closeMinutes - cutoffMin;
  let nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < openMinutes && nowMinutes < closeMinutes - 1440 + 1440) {
    if (openMinutes > 720 && nowMinutes < 720) nowMinutes += 1440;
  }
  const acceptEndStr = minutesToTimeStr(acceptEndMinutes);
  const acceptStartStr = formatTime(openTime);
  if (nowMinutes >= openMinutes && nowMinutes <= acceptEndMinutes) {
    setStatus({ available: true, reason: "ok", acceptStart: acceptStartStr, acceptEnd: acceptEndStr });
  } else {
    setStatus({ available: false, reason: "outside_hours", acceptStart: acceptStartStr, acceptEnd: acceptEndStr });
  }
}

function useSameDayAvailability(store: Store | null): SameDayStatus {
  const [status, setStatus] = useState<SameDayStatus>({
    available: false,
    reason: "no_schedule",
    acceptStart: null,
    acceptEnd: null,
  });

  useEffect(() => {
    if (!store) return;
    const check = async () => {
      const { supabase } = await import("@/lib/supabase");
      const now = new Date();
      const fmtKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const todayKey = fmtKey(now);
      const todayDow = now.getDay();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = fmtKey(yesterday);
      const yesterdayDow = yesterday.getDay();

      const { data: hours } = await supabase
        .from("store_business_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("store_id", store.id);

      const hoursMap = new Map<number, { is_closed: boolean; open_time: string | null; close_time: string | null }>();
      (hours || []).forEach((h: any) => hoursMap.set(h.day_of_week, h));

      const { data: orderRules } = await supabase
        .from("store_order_rules")
        .select("default_lead_time_minutes")
        .eq("store_id", store.id)
        .maybeSingle();

      const cutoffMinutes = orderRules?.default_lead_time_minutes ?? 60;
      const todayHours = hoursMap.get(todayDow);
      const defaultOpen = todayHours?.open_time ?? null;
      const defaultClose = todayHours?.close_time ?? null;
      const isOvernightStore =
        defaultOpen && defaultClose && toMin(defaultOpen) > toMin(defaultClose);

      if (isOvernightStore && now.getHours() < 12) {
        const { data: yesterdaySpecial } = await supabase
          .from("store_special_dates")
          .select("is_closed, open_time, close_time")
          .eq("store_id", store.id)
          .eq("target_date", yesterdayKey)
          .maybeSingle();
        if (yesterdaySpecial) {
          if (!yesterdaySpecial.is_closed) {
            checkTimeWindow(cutoffMinutes, yesterdaySpecial.open_time || defaultOpen, yesterdaySpecial.close_time || defaultClose, now, setStatus);
            return;
          }
        } else {
          const yHours = hoursMap.get(yesterdayDow);
          if (!yHours?.is_closed) {
            checkTimeWindow(cutoffMinutes, yHours?.open_time ?? defaultOpen, yHours?.close_time ?? defaultClose, now, setStatus);
            return;
          }
        }
      }

      const { data: todaySpecial } = await supabase
        .from("store_special_dates")
        .select("is_closed, open_time, close_time")
        .eq("store_id", store.id)
        .eq("target_date", todayKey)
        .maybeSingle();

      if (todaySpecial) {
        if (todaySpecial.is_closed) {
          setStatus({ available: false, reason: "closed_today", acceptStart: null, acceptEnd: null });
          return;
        }
        checkTimeWindow(cutoffMinutes, todaySpecial.open_time || defaultOpen, todaySpecial.close_time || defaultClose, now, setStatus);
        return;
      }

      if (todayHours?.is_closed) {
        setStatus({ available: false, reason: "closed_today", acceptStart: null, acceptEnd: null });
        return;
      }
      checkTimeWindow(cutoffMinutes, defaultOpen, defaultClose, now, setStatus);
    };
    check();
  }, [store?.id]);

  return status;
}

// ── 営業時間ヘルパー ────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface BusinessHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

function formatHoursLine(hours: BusinessHour[]): string {
  if (hours.length === 0) return "";
  const openDays = hours.filter((h) => !h.is_closed && h.open_time && h.close_time);
  if (openDays.length === 0) return "定休日";

  // 最も多いパターンを代表として使用
  const counts = new Map<string, number>();
  openDays.forEach((h) => {
    const key = `${h.open_time!.slice(0, 5)}〜${h.close_time!.slice(0, 5)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let pattern = "";
  let max = 0;
  counts.forEach((c, k) => { if (c > max) { max = c; pattern = k; } });

  const closedDays = hours
    .filter((h) => h.is_closed)
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => `${WEEKDAY_LABELS[h.day_of_week]}曜`);

  return closedDays.length > 0
    ? `${pattern}（${closedDays.join("・")}定休）`
    : pattern;
}

// ── メインページ ─────────────────────────────────────────────────────────

export default function StorePage({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const { setSelectedStoreId, setSelectedStoreName, addViewedStore } = useCustomerContext();

  const [loginDone, setLoginDone] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [store, setStore] = useState<Store | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTokushoModal, setShowTokushoModal] = useState(false);
  const [tokushoText, setTokushoText] = useState<string | null>(null);
  const [tokushoLoading, setTokushoLoading] = useState(false);

  useEffect(() => {
    if (!showTokushoModal || !params.storeId) return;
    setTokushoLoading(true);
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("stores").select("tokusho_text").eq("id", params.storeId).maybeSingle().then(({ data }) => {
        setTokushoText(data?.tokusho_text ?? null);
        setTokushoLoading(false);
      });
    });
  }, [showTokushoModal, params.storeId]);

  const sameDayStatus = useSameDayAvailability(loginDone ? store : null);
  const sameDayOk = sameDayStatus.available;

  // 常にLINEログインを実行（前回セッションキャッシュを無視）
  useEffect(() => {
    if (authLoading) return;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      // LIFF未設定の場合はキャッシュユーザーをそのまま使用
      if (user) setLoginDone(true);
      return;
    }

    // 直前にroot pageでLIFFログイン済みなら再実行不要
    const ts = sessionStorage.getItem(LIFF_LOGIN_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) < 15000 && user) {
      setLoginDone(true);
      return;
    }

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isInClient()) {
          if (user) { setLoginDone(true); return; }
          setLoginError("このページはLINEアプリからアクセスしてください");
          return;
        }

        // LINEクライアント内：常にフレッシュログイン
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
        setUser(null);

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const { authUser } = await completeLiffLogin(liff);
        setUser(authUser);
        sessionStorage.setItem(LIFF_LOGIN_TIMESTAMP_KEY, Date.now().toString());
        setLoginDone(true);
      } catch (err: any) {
        console.error("[Store LIFF] auto-login error:", err);
        setLoginError(err?.message || "LIFF初期化エラー");
      }
    })();
  }, [authLoading]);

  // 店舗情報フェッチ
  useEffect(() => {
    const fetchData = async () => {
      const { supabase } = await import("@/lib/supabase");
      const [{ data: storeRow }, { data: hours }] = await Promise.all([
        supabase.from("stores").select("*").eq("id", params.storeId).maybeSingle(),
        supabase
          .from("store_business_hours")
          .select("day_of_week, is_closed, open_time, close_time")
          .eq("store_id", params.storeId)
          .order("day_of_week"),
      ]);
      if (storeRow) {
        const uiStore = toUIStore(storeRow);
        setStore(uiStore);
        setSelectedStoreId(uiStore.id);
        setSelectedStoreName(uiStore.name);
        addViewedStore(uiStore.id);
      }
      setBusinessHours(hours || []);
    };
    fetchData();
  }, [params.storeId]);

  const handleSameDay = () => {
    router.push(`/customer/takeout/products?store=${params.storeId}&type=sameday`);
  };

  const handleReservation = () => {
    router.push(`/customer/takeout/products?store=${params.storeId}&type=reservation`);
  };

  // LINEログイン中画面
  if (!loginDone) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-[#FFF9C4] h-2.5 shrink-0" aria-hidden />
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-xs text-center"
          >
            {loginError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                <p className="text-sm font-bold text-red-700 mb-1">ログインエラー</p>
                <p className="text-xs text-red-600 break-all">{loginError}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <LineSpinner size={30} />
                <p className="text-base font-bold text-gray-900">LINEログイン中...</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // 店舗TOPページ
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 店舗情報セクション */}
      {store && (
        <div className="border-b border-gray-100">
          {/* ヒーロー画像 */}
          <div className="w-full h-40 overflow-hidden bg-gray-100">
            {store.image ? (
              <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-amber-50">
                {store.logoUrl && (
                  <img src={store.logoUrl} alt={store.name} className="h-20 w-auto object-contain opacity-40" />
                )}
              </div>
            )}
          </div>

          {/* 店舗名・詳細 */}
          <div className="px-4 pt-3 pb-4 space-y-2">
            <h1 className="text-base font-bold text-gray-900 leading-snug">{store.name}</h1>

            <div className="space-y-1.5">
              {/* 住所 */}
              {store.address && (
                <div className="flex items-start gap-2 text-[13px] text-gray-500">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                  <span>
                    {store.postalCode && `〒${store.postalCode} `}
                    {store.address}
                    {store.building && ` ${store.building}`}
                  </span>
                </div>
              )}

              {/* 営業時間（1行サマリー） */}
              {businessHours.length > 0 && (
                <div className="flex items-center gap-2 text-[13px] text-gray-500">
                  <Clock className="w-4 h-4 shrink-0 text-gray-400" />
                  <span>{formatHoursLine(businessHours)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 注文タイプ選択 */}
      <div className="px-4 pt-4 pb-8 flex-1">
        <h2 className="text-base font-bold text-gray-900 text-center leading-snug mb-5">
          ご注文方法を選択してください
        </h2>

        {/* 当日受取注文 */}
        <button
          onClick={sameDayOk ? handleSameDay : undefined}
          disabled={!sameDayOk}
          className={`w-full border rounded-xl p-4 mb-3 text-left transition-shadow ${
            sameDayOk
              ? "border-gray-200 hover:shadow-md bg-white active:bg-gray-50"
              : "border-gray-200 bg-white cursor-default"
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sameDayOk ? "bg-amber-100" : "bg-gray-100"}`}>
              <Clock className={`w-4 h-4 ${sameDayOk ? "text-amber-500" : "text-gray-400"}`} />
            </div>
            <span className={`text-sm font-bold ${sameDayOk ? "text-gray-900" : "text-gray-400"}`}>
              当日受取注文
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${sameDayOk ? "text-gray-500" : "text-gray-400"}`}>
            本日お店に並んでいる商品からご注文いただけます。
          </p>
          {sameDayOk && sameDayStatus.acceptStart && sameDayStatus.acceptEnd && (
            <p className="text-xs mt-1.5 font-bold text-amber-500">
              {sameDayStatus.acceptStart}〜{sameDayStatus.acceptEnd}の間で受付しています。
            </p>
          )}
          {!sameDayOk && (
            <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2">
              {sameDayStatus.reason === "closed_today" ? (
                <p className="text-xs text-gray-700">本日は定休日のため受け付けていません。</p>
              ) : (
                <p className="text-xs text-gray-700">ただいま当日注文は受け付けていません。</p>
              )}
              {sameDayStatus.acceptStart && sameDayStatus.acceptEnd && (
                <p className="text-xs text-gray-700 mt-0.5">
                  <span className="font-bold text-amber-500">
                    {sameDayStatus.acceptStart}〜{sameDayStatus.acceptEnd}
                  </span>
                  の間で受付しています。
                </p>
              )}
            </div>
          )}
        </button>

        {/* 予約注文 */}
        <button
          onClick={handleReservation}
          className="w-full border border-gray-200 rounded-xl p-4 text-left hover:shadow-md transition-shadow bg-white active:bg-gray-50"
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-sm font-bold text-gray-900">予約注文</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">24時間ご予約を受付しています。</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            本日から2営業日後以降からご予約いただけます。
          </p>
          <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400 font-bold">ホールケーキなどのご注文はこちら</p>
          </div>
        </button>

        {/* 利用規約・特商法リンク */}
        <div className="text-center space-y-2 pt-6 pb-2">
          <button onClick={() => setShowTermsModal(true)} className="text-xs text-gray-400 underline underline-offset-2">利用規約</button>
          <span className="text-xs text-gray-300 mx-2">|</span>
          <button onClick={() => setShowPrivacyModal(true)} className="text-xs text-gray-400 underline underline-offset-2">プライバシーポリシー</button>
          <span className="text-xs text-gray-300 mx-2">|</span>
          <button onClick={() => setShowTokushoModal(true)} className="text-xs text-gray-400 underline underline-offset-2">特定商取引法</button>
        </div>
      </div>

      {/* 利用規約モーダル */}
      <AnimatePresence>
        {showTermsModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[60]" onClick={() => setShowTermsModal(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-[70] max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <p className="font-bold text-gray-900 text-base">パティモバ 利用規約</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">最終改定日：2025年5月14日</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
                <p className="text-xs text-gray-600 leading-relaxed">本利用規約（以下「本規約」）は、パティモバ（以下「当サービス」）の提供に関する条件を定めたものです。ユーザーには本規約に従って当サービスをご利用いただきます。</p>
                {TERMS_SECTIONS.map((s) => (
                  <div key={s.title}>
                    <p className="text-xs font-bold text-gray-900 mb-1">{s.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* プライバシーポリシーモーダル */}
      <AnimatePresence>
        {showPrivacyModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[60]" onClick={() => setShowPrivacyModal(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-[70] max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <p className="font-bold text-gray-900 text-base">パティモバ プライバシーポリシー</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">最終改定日：2025年5月14日</p>
                </div>
                <button onClick={() => setShowPrivacyModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
                <p className="text-xs text-gray-600 leading-relaxed">Crafted Glow株式会社（以下「運営者」）は、パティモバ（以下「当サービス」）において、ユーザーの個人情報を適切に取り扱うことが重要な責務であると認識し、以下のとおりプライバシーポリシーを定め、これを遵守します。</p>
                {PRIVACY_SECTIONS.map((s) => (
                  <div key={s.title}>
                    <p className="text-xs font-bold text-gray-900 mb-1">{s.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 特定商取引法モーダル */}
      <AnimatePresence>
        {showTokushoModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[60]" onClick={() => setShowTokushoModal(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-[70] max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <p className="font-bold text-gray-900 text-base">特定商取引法に基づく表記</p>
                <button onClick={() => setShowTokushoModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-5">
                {tokushoLoading ? (
                  <div className="flex justify-center py-10"><LineSpinner size={20} /></div>
                ) : tokushoText ? (
                  <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{tokushoText}</pre>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-10">各店舗の特定商取引法に基づく表記がこちらに表示されます。</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
