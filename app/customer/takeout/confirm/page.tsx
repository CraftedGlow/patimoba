"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, PartyPopper, ShoppingBag } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { supabase } from "@/lib/supabase";
import { getLiffId } from "@/lib/get-liff-id";
import { getStoreIdsWithParent, fetchProductStoreOverrides, applyProductStoreOverride } from "@/lib/store-hierarchy";

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

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

type PointOption = "none" | "partial" | "all";
type PaymentMethod = "credit" | "store";

export default function TakeoutConfirmPage() {
  const router = useRouter();
  const { userId, selectedStoreId, profile, points: userPoints, refreshPoints } = useCustomerContext();
  const { items: cartItems, total: cartTotal, storeId: cartStoreId, clear: clearCart } = useCart();
  const { createOrder } = useOrderMutations();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPointModal, setShowPointModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTokushoModal, setShowTokushoModal] = useState(false);
  const [tokushoText, setTokushoText] = useState<string | null>(null);
  const [tokushoLoading, setTokushoLoading] = useState(false);

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [hasCardInfo, setHasCardInfo] = useState(false);
  const [cardLabel, setCardLabel] = useState("");
  const [selectedBag, setSelectedBag] = useState<{ id: string; name: string; price: number; quantity: number } | null>(null);
  // カート内に「店頭決済のみ」の商品が含まれるか
  const [paymentRestricted, setPaymentRestricted] = useState(false);

  useEffect(() => {
    const sid = selectedStoreId || cartStoreId;
    const productIds = cartItems.map((i) => i.productId).filter(Boolean);
    if (!sid || productIds.length === 0) { setPaymentRestricted(false); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("products")
        .select("id, store_id, payment_method_restriction")
        .in("id", productIds);
      if (cancelled || !rows) return;
      const { parentStoreId } = await getStoreIdsWithParent(sid);
      const overrides = await fetchProductStoreOverrides(sid, parentStoreId);
      const merged = rows.map((row: any) => applyProductStoreOverride(row, row.id, parentStoreId, overrides));
      const restricted = merged.some((r: any) => r.payment_method_restriction === "store_only");
      if (!cancelled) setPaymentRestricted(restricted);
    })();
    return () => { cancelled = true; };
  }, [selectedStoreId, cartStoreId, cartItems]);

  useEffect(() => {
    if (paymentRestricted) setPaymentMethod("store");
  }, [paymentRestricted]);

  useEffect(() => {
    if (!showTokushoModal) return;
    const sid = selectedStoreId || cartStoreId;
    if (!sid) return;
    setTokushoLoading(true);
    supabase.from("stores").select("name, tokusho_text").eq("id", sid).maybeSingle().then(({ data }) => {
      setTokushoText(data?.tokusho_text ?? null);
      setTokushoLoading(false);
    });
  }, [showTokushoModal, selectedStoreId, cartStoreId]);

  useEffect(() => {
    const d = sessionStorage.getItem("patimoba_pickup_date") ?? "";
    const t = sessionStorage.getItem("patimoba_pickup_time") ?? "";
    setPickupDate(d);
    setPickupTime(t);
    setHasCardInfo(!!sessionStorage.getItem("patimoba_has_card"));
    setCardLabel(sessionStorage.getItem("patimoba_card_label") || "");

    try {
      const bagRaw = sessionStorage.getItem("patimoba_selected_bag");
      if (bagRaw) setSelectedBag(JSON.parse(bagRaw));
    } catch {
      /* ignore */
    }

    // 3DS リダイレクト戻り時：カード表示を先行セット
    try {
      const pendingRaw = sessionStorage.getItem("patimoba_pending_3ds");
      if (pendingRaw) {
        const { cardLabel: pendingLabel } = JSON.parse(pendingRaw);
        setHasCardInfo(true);
        setCardLabel(pendingLabel);
      }
    } catch { /* ignore */ }
  }, []);

  // LIFF 外部ブラウザで 3DS 完了後にページが再表示されたとき DB を再確認
  useEffect(() => {
    if (!userId) return;
    const onVisible = async () => {
      if (document.hidden || hasCardInfo) return;
      const pendingRaw = (() => { try { return sessionStorage.getItem("patimoba_pending_3ds"); } catch { return null; } })();
      if (!pendingRaw) return;
      const { data } = await supabase.from("users").select("customer_id").eq("id", userId).maybeSingle();
      if (data?.customer_id) {
        const { cardLabel: pendingLabel } = JSON.parse(pendingRaw);
        sessionStorage.setItem("patimoba_has_card", "1");
        sessionStorage.removeItem("patimoba_pending_3ds");
        setHasCardInfo(true);
        setCardLabel(sessionStorage.getItem("patimoba_card_label") || pendingLabel);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, hasCardInfo]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("name, name_kana, phone, customer_id")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const source = data.name_kana || data.name || "";
      if (source) {
        const parts = source.split(/\s+/);
        setLastName(parts[0] ?? "");
        setFirstName(parts.slice(1).join(" ") ?? "");
      }
      if (data.phone) setPhone(data.phone);

      // 既存カードをセッションに未格納の場合は PAY.JP から取得して表示
      if (data.customer_id && !sessionStorage.getItem("patimoba_has_card")) {
        const res = await fetch(`/api/payjp/cards?customer_id=${data.customer_id}`);
        if (!res.ok || cancelled) return;
        const cardsData = await res.json();
        const card = cardsData.data?.[0];
        if (!card || cancelled) return;
        const label = `${card.brand} ****${card.last4}`;
        sessionStorage.setItem("patimoba_has_card", "1");
        sessionStorage.setItem("patimoba_card_label", label);
        sessionStorage.setItem("patimoba_customer_id", data.customer_id);
        setHasCardInfo(true);
        setCardLabel(label);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // カード登録ページから戻った後: pending token で顧客作成 → DB 保存
  // checkout.js iframe ワークフローは tds_finish 済みのため skip_tds_finish: true
  // token を取得直後に sessionStorage から削除することで StrictMode の二重実行を防ぐ
  useEffect(() => {
    if (!userId) return;
    const pendingToken = (() => {
      try {
        const t = sessionStorage.getItem("patimoba_pending_token");
        if (t) sessionStorage.removeItem("patimoba_pending_token");
        return t;
      } catch { return null; }
    })();
    if (!pendingToken) return;
    (async () => {
      console.log("[takeout-confirm] finalize-card 開始, token:", pendingToken);
      const res = await fetch("/api/payjp/finalize-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_id: pendingToken, user_id: userId, skip_tds_finish: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[takeout-confirm] finalize-card エラー:", data.error);
        setSubmitError("カードの登録に失敗しました: " + (data.error?.message ?? data.error ?? ""));
        return;
      }
      console.log("[takeout-confirm] finalize-card 成功, customerId:", data.customerId);
      const label = (() => { try { return sessionStorage.getItem("patimoba_card_label") || "カード"; } catch { return "カード"; } })();
      try {
        sessionStorage.setItem("patimoba_has_card", "1");
        sessionStorage.setItem("patimoba_customer_id", data.customerId);
      } catch { /* ignore */ }
      setHasCardInfo(true);
      setCardLabel(label);
    })();
  }, [userId]);

  const bagTotal = selectedBag ? selectedBag.price * selectedBag.quantity : 0;
  const subtotal = cartTotal + bagTotal;
  const availablePoints = userPoints;

  const usedPoints =
    pointOption === "all"
      ? Math.min(availablePoints, subtotal)
      : pointOption === "partial"
        ? Math.min(Number(partialPoints) || 0, availablePoints, subtotal)
        : 0;

  const total = subtotal - usedPoints;
  const earnedPoints = Math.floor(total / 200); // 100円 = 0.5pt

  const handleConfirmOrder = async () => {
    console.log("[takeout-confirm] 注文を確定するボタン clicked, paymentMethod:", paymentMethod, "total:", total);
    if (submittingRef.current) return;
    submittingRef.current = true;
    const persistedStoreId = (() => { try { return localStorage.getItem("patimoba_selected_store_id") } catch { return null } })();
    const storeIdForOrder = selectedStoreId || cartStoreId || persistedStoreId;
    if (!storeIdForOrder) { submittingRef.current = false; setSubmitError("店舗が選択されていません"); return; }
    if (cartItems.length === 0) { submittingRef.current = false; setSubmitError("カートに商品がありません"); return; }
    if (paymentRestricted && paymentMethod === "credit") { submittingRef.current = false; setSubmitError("この注文は店頭決済のみご利用いただけます"); return; }

    setSubmitting(true);
    setSubmitError(null);

    const printPhotoUrl = cartItems.find((i) => i.customization?.printPhotoUrl)?.customization?.printPhotoUrl ?? null;

    let payjpChargeId: string | null = null;

    // クレジットカード払いの場合は先に PAY.JP で課金する
    if (paymentMethod === "credit") {
      console.log("[takeout-confirm] PAY.JP charge 開始, userId:", userId, "storeId:", storeIdForOrder, "amount:", total);
      const chargeRes = await fetch("/api/payjp/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          storeId: storeIdForOrder,
          amount: total,
          currency: "jpy",
        }),
      });
      const chargeData = await chargeRes.json();
      console.log("[takeout-confirm] charge →", chargeRes.status, chargeData);
      if (!chargeRes.ok) {
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitError(chargeData.error?.message ?? "決済処理に失敗しました");
        return;
      }
      payjpChargeId = chargeData.chargeId ?? null;
    }

    console.log("[takeout-confirm] createOrder 開始");
    const result = await createOrder({
      storeId: storeIdForOrder,
      customerId: userId,
      customerName: `${lastName} ${firstName}`.trim() || null,
      paymentStatus: paymentMethod === "credit" ? "paid" : "unpaid",
      paymentMethod,
      items: cartItems,
      subtotal,
      discountAmount: usedPoints,
      orderType: "takeout",
      pickupDate: pickupDate || null,
      pickupTime: pickupTime || null,
      printPhotoUrl,
      payjpChargeId,
      bag: selectedBag ? { name: selectedBag.name, unitPrice: selectedBag.price, quantity: selectedBag.quantity } : null,
    });

    submittingRef.current = false;
    setSubmitting(false);
    console.log("[takeout-confirm] createOrder →", result);

    if (result.error) { setSubmitError(result.error); return; }

    if (result.orderId) {
      setCompletedOrderId(result.orderId);
      let serviceMessageSent = false;

      // 注文フローを開始した LIFF（一覧 LIFF または店舗固有 LIFF）を取得
      const orderLiffId = (() => { try { return sessionStorage.getItem("patimoba_order_liff_id"); } catch { return null; } })();

      // 3DS リダイレクト前に保存した notification token があれば優先して使う
      const preIssuedToken = (() => { try { return sessionStorage.getItem("patimoba_notification_token"); } catch { return null; } })();
      if (preIssuedToken) {
        try { sessionStorage.removeItem("patimoba_notification_token"); } catch { /* ignore */ }
        fetch("/api/line/send-service-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: result.orderId, notificationToken: preIssuedToken, ...(orderLiffId ? { sourceLiffId: orderLiffId } : {}) }),
        }).catch(() => {});
        serviceMessageSent = true;
      }

      if (!serviceMessageSent) {
        try {
          // orderLiffId（一覧 LIFF）がある場合はそれで init し、なければ店舗の LIFF にフォールバック
          const liffId = orderLiffId || (await getLiffId(storeIdForOrder));
          const liff = (await import("@line/liff")).default;
          if (liffId) await liff.init({ liffId });
          const liffAccessToken = liff.getAccessToken();
          if (liffAccessToken) {
            const tokenRes = await fetch("/api/line/issue-notification-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result.orderId, liffAccessToken, ...(orderLiffId ? { sourceLiffId: orderLiffId } : {}) }),
            });
            if (tokenRes.ok) {
              const { notificationToken } = await tokenRes.json();
              fetch("/api/line/send-service-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: result.orderId, notificationToken, ...(orderLiffId ? { sourceLiffId: orderLiffId } : {}) }),
              }).catch(() => {});
              serviceMessageSent = true;
            }
          }
        } catch { /* LIFF未初期化時はスキップ */ }
      }

      if (!serviceMessageSent) {
        fetch("/api/line/send-order-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: result.orderId }),
        }).catch(() => {});
      }
    }

    // ポイント付与・消費と電話番号をDBに反映
    if (userId) {
      const { data: userData } = await supabase
        .from("users")
        .select("points")
        .eq("id", userId)
        .maybeSingle();
      const currentPts = Number(userData?.points) || 0;
      const newPts = Math.max(0, currentPts - usedPoints + earnedPoints);
      await supabase
        .from("users")
        .update({ points: newPts, ...(phone.trim() ? { phone: phone.trim() } : {}) })
        .eq("id", userId);
      await refreshPoints();
    }

    clearCart();
    sessionStorage.removeItem("patimoba_pickup_date");
    sessionStorage.removeItem("patimoba_pickup_time");
    sessionStorage.removeItem("patimoba_order_type");
    sessionStorage.removeItem("patimoba_selected_bag");
    setShowOrderComplete(true);
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          router.push(continueShoppingHref);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const continueShoppingHref = selectedStoreId || cartStoreId
    ? `/customer/takeout/products?store=${selectedStoreId || cartStoreId}`
    : "/customer/takeout";

  const handleContinueShopping = () => { console.log("[takeout-confirm] 買い物を続けるボタン clicked"); router.push(continueShoppingHref); };
  const handlePointChange = () => { console.log("[takeout-confirm] ポイント変更 確定, option:", tempPointOption); setPointOption(tempPointOption); setShowPointModal(false); };
  const pointLabel = pointOption === "none" ? "利用なし" : `${usedPoints}ポイント利用`;

  const handleStepClick = (step: number) => {
    if (step === 1) router.push("/customer/takeout");
    if (step === 2 && selectedStoreId) router.push(`/customer/takeout/products?store=${selectedStoreId}`);
    if (step === 3) router.push("/customer/takeout/pickup");
  };

  const fmtDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={userPoints}
        onCartClick={() => setCartOpen(true)}
      />

      <StepProgress
        currentStep={4}
        steps={steps}
        onStepClick={handleStepClick}
        maxWidthClassName="md:max-w-2xl md:mx-auto"
      />

      <div className="px-4 md:px-8 lg:px-12 pb-10 md:max-w-2xl md:mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-600 mt-0.5">まだ注文は確定していません</p>
        </div>

        {/* 受け取り日時 (表示のみ) */}
        {(pickupDate || pickupTime) && (
          <div className="mb-4 border border-amber-200 rounded-xl px-4 py-3 bg-amber-50/60">
            <p className="text-xs font-bold text-amber-700 mb-0.5">受け取り日時</p>
            <p className="text-sm font-bold text-gray-900">
              {fmtDate(pickupDate)}{pickupTime ? `　${pickupTime}` : ""}
            </p>
          </div>
        )}

        {/* お名前 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">お名前(カタカナ)</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="セイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
            />
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="メイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* 電話番号 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">電話番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09012345678"
            maxLength={11}
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="text-xs text-gray-600 mt-1">※日中に連絡の取れる電話番号</p>
        </div>

        {/* ポイント利用 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">ポイント利用</span>
            <button
              onClick={() => { console.log("[takeout-confirm] ポイント変更ボタン clicked"); setTempPointOption(pointOption); setShowPointModal(true); }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              変更
            </button>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{pointLabel}</p>
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">ご利用可能ポイント </span>
            <span className="text-red-500 font-bold">{availablePoints}</span>
            <span className="text-red-500"> ポイント</span>
          </p>
        </div>

        {/* お支払い方法 */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">お支払い方法</p>
          <div className="flex items-center gap-6">
            {!paymentRestricted && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "credit"}
                  onChange={() => setPaymentMethod("credit")}
                  className="w-4 h-4 accent-green-500"
                />
                <span className="text-sm">クレジットカード</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "store"}
                onChange={() => setPaymentMethod("store")}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm">店頭支払い</span>
            </label>
          </div>
          {paymentRestricted && (
            <p className="text-xs text-amber-600 mt-2">
              店頭決済のみご利用いただける商品が含まれているため、店頭支払いのみとなります
            </p>
          )}
        </div>

        {paymentMethod === "credit" && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                console.log("[takeout-confirm] カード情報登録ボタン clicked");
                sessionStorage.setItem("patimoba_tds_return_path", "/customer/takeout/confirm");
                router.push("/customer/payment/card");
              }}
              className={`w-full border-2 font-bold py-2.5 rounded-md text-sm flex items-center justify-center gap-1 transition-colors ${hasCardInfo ? "border-green-400 text-green-600 hover:bg-green-50" : "border-amber-400 text-amber-500 hover:bg-amber-50"}`}
            >
              {hasCardInfo ? `✓ ${cardLabel || "カード情報登録済み"}（変更する）` : "＋ カード情報を登録する"}
            </button>
            {!hasCardInfo && (
              <p className="text-xs text-red-500 mt-1.5">カード情報を登録しないと注文を確定できません</p>
            )}
          </div>
        )}

        {/* 注文商品 + 合計 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <ShoppingBag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">注文商品・金額</span>
          </div>
          {/* 商品一覧 */}
          <div className="divide-y divide-gray-100">
            {cartItems.map((item, idx) => {
              const c = item.customization;
              const optSum = [
                (c?.sizePrice ?? 0),
                ...(c?.candles ?? []).map((cd) => cd.price * cd.quantity),
                ...(c?.options ?? []).map((op) => op.price),
                ...(c?.customOptions ?? []).map((o) => o.additionalPrice || 0),
                c?.noshi?.price ?? 0,
              ].reduce((s, v) => s + v, 0);
              const lineTotal = (item.price + optSum) * item.quantity;
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {c?.sizeLabel && <p className="text-xs text-gray-500">{c.sizeLabel}</p>}
                    {(c?.customOptions ?? []).map((o, i) => (
                      <p key={i} className="text-xs text-gray-500">{o.name}: {(o.values ?? []).join("、")}</p>
                    ))}
                    {c?.noshi && (
                      <p className="text-xs text-gray-500">
                        のし：{c.noshi.name}{c.noshi.purpose && `（${c.noshi.purpose}）`}{c.noshi.displayName && `「${c.noshi.displayName}」`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">¥{lineTotal.toLocaleString()}</p>
                    {item.quantity > 1 && <p className="text-xs text-gray-600">×{item.quantity}</p>}
                  </div>
                </div>
              );
            })}
            {selectedBag && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">袋: {selectedBag.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">¥{bagTotal.toLocaleString()}</p>
                  {selectedBag.quantity > 1 && <p className="text-xs text-gray-600">×{selectedBag.quantity}</p>}
                </div>
              </div>
            )}
          </div>
          {/* 合計 */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-sm text-gray-900">{subtotal.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ポイント利用</span>
              <span className="text-sm text-gray-500">{pointLabel}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-gray-200">
              <span className="text-sm font-bold">支払い金額</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                <span className="text-base ml-0.5">円</span>
                <span className="ml-1 text-gray-600" style={{ fontSize: 11 }}>(税込)</span>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm font-bold">獲得予定ポイント</span>
              <div className="text-right">
                <span className="text-red-500 font-bold text-lg">{earnedPoints}</span>
                <span className="text-red-500 text-sm ml-0.5">ポイント</span>
                <p className="text-xs text-gray-600">1ポイント=1円</p>
              </div>
            </div>
          </div>
        </div>

        {submitError && (
          <p className="text-xs text-red-500 text-center mb-2">{submitError}</p>
        )}

        <div className="flex gap-3 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinueShopping}
            className="flex-1 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-md text-sm transition-colors hover:bg-amber-50"
          >
            買い物を続ける
          </motion.button>
          <motion.button
            whileHover={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 1.02 }}
            whileTap={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim() ? undefined : { scale: 0.98 }}
            onClick={handleConfirmOrder}
            disabled={submitting || (paymentMethod === "credit" && !hasCardInfo) || !lastName.trim() || !firstName.trim() || !phone.trim()}
            className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md text-sm transition-colors"
          >
            {submitting ? "処理中..." : "注文を確定する"}
          </motion.button>
        </div>

        <div className="text-center pt-2 pb-4">
          <button onClick={() => setShowTermsModal(true)} className="text-xs text-gray-600 underline underline-offset-2">利用規約</button>
          <span className="text-xs text-gray-300 mx-2">|</span>
          <button onClick={() => setShowPrivacyModal(true)} className="text-xs text-gray-600 underline underline-offset-2">プライバシーポリシー</button>
          <span className="text-xs text-gray-300 mx-2">|</span>
          <button onClick={() => setShowTokushoModal(true)} className="text-xs text-gray-600 underline underline-offset-2">特定商取引法</button>
        </div>

      </div>

      {/* ポイント変更モーダル */}
      <AnimatePresence>
        {showPointModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
              onClick={() => setShowPointModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-6"
            >
              <button
                onClick={() => setShowPointModal(false)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-base font-bold">利用可能ポイント</span>
                <span className="text-3xl font-bold text-red-500">{availablePoints}</span>
              </div>
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "partial"} onChange={() => setTempPointOption("partial")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">一部のポイントを使う</span>
                </label>
                {tempPointOption === "partial" && (
                  <input
                    type="number"
                    value={partialPoints}
                    onChange={(e) => setPartialPoints(e.target.value)}
                    placeholder="利用するポイント数"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm ml-8 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    style={{ width: "calc(100% - 2rem)" }}
                    max={Math.min(availablePoints, subtotal)}
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "all"} onChange={() => setTempPointOption("all")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">全部のポイントを使う</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="points" checked={tempPointOption === "none"} onChange={() => setTempPointOption("none")} className="w-5 h-5 accent-amber-500" />
                  <span className="text-sm">ポイントを利用しない</span>
                </label>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePointChange}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
              >
                変更する
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 注文完了モーダル */}
      <AnimatePresence>
        {showOrderComplete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center"
            >
              <button
                onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); router.push(continueShoppingHref); }}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-amber-500" />
                </div>
              </div>
              <p className="text-base leading-relaxed text-gray-900 font-bold mb-2">
                ご注文ありがとうございます！
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-1">
                注文情報がLINEに届いています。
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                来店時にLINEのメッセージをお見せください。
              </p>
              {countdown > 0 && (
                <p className="text-xs text-gray-600 mb-4">
                  {countdown}秒後に自動で商品一覧に戻ります
                </p>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { console.log("[takeout-confirm] 商品一覧に戻るボタン clicked"); if (countdownRef.current) clearInterval(countdownRef.current); router.push(continueShoppingHref); }}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base transition-colors"
              >
                商品一覧に戻る
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <p className="text-[10px] text-gray-600 mt-0.5">最終改定日：2025年5月14日</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-600 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                  <p className="text-[10px] text-gray-600 mt-0.5">最終改定日：2025年5月14日</p>
                </div>
                <button onClick={() => setShowPrivacyModal(false)} className="text-gray-600 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                <button onClick={() => setShowTokushoModal(false)} className="text-gray-600 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-5">
                {tokushoLoading ? (
                  <div className="flex justify-center py-10"><LineSpinner size={20} /></div>
                ) : tokushoText ? (
                  <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{tokushoText}</pre>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-10">各店舗の特定商取引法に基づく表記がこちらに表示されます。</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} readOnly hideProceed />
    </div>
  );
}
