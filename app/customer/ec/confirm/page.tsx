"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, ShoppingBag, PartyPopper, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { useCustomerContext } from "@/lib/customer-context";
import { useAuth } from "@/lib/auth-context";
import { useEcContext } from "@/lib/ec-context";
import { useCart } from "@/lib/cart-context";
import { getStoreLiffIdStrict } from "@/lib/get-liff-id";
import { calcItemSubtotal } from "@/lib/cart-pricing";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/auth-fetch";
import { PrintReceipt } from "@/components/customer/ec/print-receipt";
import type { UICartItem } from "@/lib/types";
import { useMyCoupons, type MyCouponEligibility } from "@/hooks/use-my-coupons";
import { calcCouponDiscountAmount } from "@/lib/coupons";
import { loadCheckoutAttempt, saveCheckoutAttempt, newCheckoutAttempt } from "@/lib/checkout-attempt";

const CHECKOUT_ATTEMPT_KEY = "ec_checkout_attempt";

function previewCouponDiscount(c: Pick<MyCouponEligibility, "discountType" | "discountValue">, subtotal: number) {
  return calcCouponDiscountAmount({ discount_type: c.discountType, discount_value: c.discountValue }, subtotal);
}

function couponEligibleLabel(c: Pick<MyCouponEligibility, "discountType" | "discountValue">, subtotal: number) {
  return c.discountType === "percentage"
    ? `${c.discountValue}%オフ`
    : `-${previewCouponDiscount(c, subtotal).toLocaleString()}円`;
}

async function releaseCoupon(deliveryId: string) {
  try {
    await authFetch("/api/coupons/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    });
  } catch {
    // ベストエフォート。失敗しても呼び出し元のエラー表示自体は成立させる
  }
}

const deliveryTimeSlots = [
  "午前（9:00〜12:00）",
  "昼（12:00〜15:00）",
  "夕方（15:00〜18:00）",
  "夜（18:00〜21:00）",
];

type PointOption = "none" | "partial" | "all";

interface ShippingAddress {
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
}

export default function ECConfirmPage() {
  const router = useRouter();
  const { userId, selectedStoreId, selectedStoreName, profile, points: userPoints, refreshPoints, setGuestUserId } = useCustomerContext();
  const { user } = useAuth();
  const { storeLogoUrl } = useEcContext();
  const { items: cartItems, total: cartTotal, storeId: cartStoreId, clear: clearCart } = useCart();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { evaluateEligibility } = useMyCoupons({ userId, storeId: selectedStoreId || cartStoreId });
  const [couponEligibility, setCouponEligibility] = useState<MyCouponEligibility[]>([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<MyCouponEligibility | null>(null);

  const [lastName, setLastName] = useState(() => { try { return sessionStorage.getItem("ec_customer_last_name") ?? "" } catch { return "" } });
  const [firstName, setFirstName] = useState(() => { try { return sessionStorage.getItem("ec_customer_first_name") ?? "" } catch { return "" } });
  const [phone, setPhone] = useState(() => { try { return sessionStorage.getItem("ec_customer_phone") ?? "" } catch { return "" } });
  const [email, setEmail] = useState(() => { try { return sessionStorage.getItem("ec_customer_email") ?? "" } catch { return "" } });
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  // 送料は注文確定時と同じ計算をサーバーで行った結果を表示する（読み込み中・失敗時は注文を確定できない）
  const [shippingFeeStatus, setShippingFeeStatus] = useState<"loading" | "ready" | "error">("loading");
  const [shippingFeeReloadKey, setShippingFeeReloadKey] = useState(0);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [hasCardInfo, setHasCardInfo] = useState(false);
  const [cardLabel, setCardLabel] = useState("");

  const [showPointModal, setShowPointModal] = useState(false);
  const [pointOption, setPointOption] = useState<PointOption>("none");
  const [tempPointOption, setTempPointOption] = useState<PointOption>("none");
  const [partialPoints, setPartialPoints] = useState("");
  const [showOrderComplete, setShowOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  // 注文完了後に印刷用データを保持
  const [orderedItems, setOrderedItems] = useState<UICartItem[]>([]);
  const [orderDateTime, setOrderDateTime] = useState<Date>(new Date());
  const [orderedSubtotal, setOrderedSubtotal] = useState(0);
  const [orderedShippingFee, setOrderedShippingFee] = useState(0);
  const [orderedUsedPoints, setOrderedUsedPoints] = useState(0);
  const [orderedTotal, setOrderedTotal] = useState(0);

  // sessionStorage から配送情報・カード情報を復元
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ec_shipping_address");
      if (raw) setShippingAddress(JSON.parse(raw));
      const time = sessionStorage.getItem("ec_delivery_time");
      if (time) setDeliveryTime(time);
      // 前の画面で計算した送料は読み込み中の仮表示にだけ使う（確定値はサーバーから取得する）
      const fee = sessionStorage.getItem("ec_shipping_fee");
      if (fee) setShippingFee(Number(fee) || 0);
      setHasCardInfo(!!sessionStorage.getItem("patimoba_has_card"));
      setCardLabel(sessionStorage.getItem("patimoba_card_label") || "");

      // 3DS リダイレクト戻り時：カード表示を先行セット
      const pendingRaw = sessionStorage.getItem("patimoba_pending_3ds");
      if (pendingRaw) {
        const { cardLabel: pendingLabel } = JSON.parse(pendingRaw);
        setHasCardInfo(true);
        setCardLabel(pendingLabel);
      }
    } catch { /* ignore */ }
    setAddressLoaded(true);
  }, []);

  // 送料をサーバー（/api/ec/create-order と同じ計算）から取得する。カート内容（送料無料の条件）や
  // 店舗の配送設定が前の画面の計算時から変わっていても、画面の表示と確定時の金額が食い違わないようにする
  const shippingStoreId = selectedStoreId || cartStoreId;
  const shippingPrefecture = shippingAddress?.prefecture ?? "";
  const shippingCartKey = JSON.stringify(cartItems);
  useEffect(() => {
    if (!addressLoaded || !shippingStoreId || cartItems.length === 0) return;
    let cancelled = false;
    setShippingFeeStatus("loading");
    (async () => {
      try {
        const res = await fetch("/api/ec/shipping-fee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: shippingStoreId, items: cartItems, prefecture: shippingPrefecture || null }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || typeof data?.shippingFee !== "number") {
          setShippingFeeStatus("error");
          return;
        }
        setShippingFee(data.shippingFee);
        setShippingFeeStatus("ready");
      } catch {
        if (!cancelled) setShippingFeeStatus("error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressLoaded, shippingStoreId, shippingPrefecture, shippingCartKey, shippingFeeReloadKey]);

  // 名前・電話番号・メールをsessionStorageに保存（カード入力ページ遷移後も維持）
  useEffect(() => {
    try {
      sessionStorage.setItem("ec_customer_last_name", lastName);
      sessionStorage.setItem("ec_customer_first_name", firstName);
      sessionStorage.setItem("ec_customer_phone", phone);
      sessionStorage.setItem("ec_customer_email", email);
    } catch { /* ignore */ }
  }, [lastName, firstName, phone, email]);

  // LIFF 外部ブラウザで 3DS 完了後にページが再表示されたとき DB を再確認
  useEffect(() => {
    if (!userId) return;
    const onVisible = async () => {
      if (document.hidden || hasCardInfo) return;
      const pendingRaw = (() => { try { return sessionStorage.getItem("patimoba_pending_3ds"); } catch { return null; } })();
      if (!pendingRaw) return;
      const res = await authFetch(`/api/customer/profile?userId=${userId}`);
      if (!res.ok) return;
      const { profile: data } = await res.json();
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

  // ログイン済み・ゲスト決済ユーザーの情報を事前入力 + 登録済みカードを取得
  // ゲストユーザーは auth_user_id を持たず users テーブルの RLS(auth_user_id = auth.uid())
  // に阻まれるため、直接クライアントから select せず service role 経由のAPIを使う
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const res = await authFetch(`/api/customer/profile?userId=${userId}`);
      if (!res.ok || cancelled) return;
      const { profile: data } = await res.json();
      if (cancelled || !data) return;
      const source = data.name_kana || data.name || "";
      if (source) {
        const parts = source.split(/\s+/);
        setLastName(parts[0] ?? "");
        setFirstName(parts.slice(1).join(" ") ?? "");
      }
      if (data.phone) setPhone(data.phone);
      if (data.email) setEmail((prev) => prev || data.email!);

      // 既存カードをセッションに未格納の場合は PAY.JP から取得して表示
      if (data.customer_id && !sessionStorage.getItem("patimoba_has_card")) {
        const res = await authFetch(`/api/payjp/cards?userId=${userId}`);
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
      console.log("[ec-confirm] finalize-card 開始, token:", pendingToken);
      const res = await authFetch("/api/payjp/finalize-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_id: pendingToken, user_id: userId, skip_tds_finish: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[ec-confirm] finalize-card エラー:", data.error);
        setSubmitError("カードの登録に失敗しました: " + (data.error?.message ?? data.error ?? ""));
        return;
      }
      console.log("[ec-confirm] finalize-card 成功, customerId:", data.customerId);
      const label = (() => { try { return sessionStorage.getItem("patimoba_card_label") || "カード"; } catch { return "カード"; } })();
      try {
        sessionStorage.setItem("patimoba_has_card", "1");
        sessionStorage.setItem("patimoba_customer_id", data.customerId);
      } catch { /* ignore */ }
      setHasCardInfo(true);
      setCardLabel(label);
    })();
  }, [userId]);

  const subtotal = cartTotal;
  const availablePoints = userPoints;

  const usedPoints =
    pointOption === "all"
      ? Math.min(availablePoints, subtotal)
      : pointOption === "partial"
        ? Math.min(Number(partialPoints) || 0, availablePoints, subtotal)
        : 0;

  const couponDiscountAmount = selectedCoupon ? previewCouponDiscount(selectedCoupon, subtotal) : 0;
  const total = Math.max(0, subtotal - usedPoints - couponDiscountAmount) + shippingFee;
  const earnedPoints = Math.floor((subtotal - usedPoints) / 200); // 100円 = 0.5pt。送料分にはポイントを付与しない

  // 金額条件だけが未達のクーポンのうち、一番あと少しで使えるようになるものを表示する
  const nearMissCoupon = couponEligibility
    .filter((c) => c.failureReason === "min_order_amount" && c.minOrderAmount != null)
    .reduce<MyCouponEligibility | null>((best, c) => {
      if (!best) return c;
      return c.minOrderAmount! - subtotal < best.minOrderAmount! - subtotal ? c : best;
    }, null);

  const productIdsKey = cartItems.map((i) => i.productId).filter(Boolean).sort().join(",");
  useEffect(() => {
    const productIds = productIdsKey ? productIdsKey.split(",") : [];
    evaluateEligibility(subtotal, productIds).then((list) => {
      setCouponEligibility(list);
      // カード登録ページへの遷移で state が消えた場合、選択していたクーポンを復元する
      setSelectedCoupon((prev) => {
        if (prev) return prev;
        try {
          const savedId = sessionStorage.getItem("ec_selected_coupon_delivery_id");
          if (!savedId) return prev;
          return list.find((c) => c.deliveryId === savedId && c.eligible) ?? prev;
        } catch { return prev; }
      });
    });
  }, [subtotal, productIdsKey, evaluateEligibility]);

  useEffect(() => {
    if (!selectedCoupon) return;
    const stillEligible = couponEligibility.find((c) => c.deliveryId === selectedCoupon.deliveryId)?.eligible;
    if (stillEligible === false) setSelectedCoupon(null);
  }, [couponEligibility, selectedCoupon]);

  // 選択中のクーポンをsessionStorageに保存（カード入力ページ遷移後も維持）
  useEffect(() => {
    try {
      if (selectedCoupon) sessionStorage.setItem("ec_selected_coupon_delivery_id", selectedCoupon.deliveryId);
      else sessionStorage.removeItem("ec_selected_coupon_delivery_id");
    } catch { /* ignore */ }
  }, [selectedCoupon]);

  const handleConfirmOrder = async () => {
    console.log("[ec-confirm] 注文を確定するボタン clicked, total:", total, "userId:", userId);
    if (submittingRef.current) return;
    submittingRef.current = true;
    const persistedStoreId = (() => { try { return localStorage.getItem("patimoba_selected_store_id") } catch { return null } })();
    const storeIdForOrder = selectedStoreId || cartStoreId || persistedStoreId;
    if (!storeIdForOrder) { submittingRef.current = false; setSubmitError("店舗が選択されていません"); return; }
    if (cartItems.length === 0) { submittingRef.current = false; setSubmitError("カートに商品がありません"); return; }
    if (shippingFeeStatus !== "ready") { submittingRef.current = false; setSubmitError("送料を計算しています。しばらくしてから再度お試しください。"); return; }

    setSubmitting(true);
    setSubmitError(null);

    const notesStr = shippingAddress
  ? `〒${shippingAddress.postalCode} ${shippingAddress.prefecture}${shippingAddress.city}${shippingAddress.address}${shippingAddress.building ? " " + shippingAddress.building : ""}　配送時間:${deliveryTime}`
      : undefined;
    const guestEmailVal = email.trim() || null;

    // 注文確定の試行。通信エラー等で結果が分からなかった場合は、同じ内容での再送に同じ試行（clientRequestId・
    // クーポン予約）を使い回し、サーバー側で二重に注文・課金されないようにする。内容が変わったら新しい試行にする。
    const fingerprint = JSON.stringify({
      storeIdForOrder, userId, cartItems, usedPoints, coupon: selectedCoupon?.deliveryId ?? null,
      shippingAddress, deliveryTime, lastName, firstName, email: guestEmailVal,
    });
    let attempt = loadCheckoutAttempt(CHECKOUT_ATTEMPT_KEY);
    if (attempt && attempt.fingerprint !== fingerprint) {
      // 以前の試行のクーポン予約は解放する（注文に紐付いた予約は解放されない）
      if (attempt.couponDeliveryId) await releaseCoupon(attempt.couponDeliveryId);
      attempt = null;
    }
    if (!attempt) attempt = newCheckoutAttempt(fingerprint);
    saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, attempt);

    // クーポンを選択している場合は注文確定の直前でサーバー側検証つきで予約する。
    // apply〜注文作成までの間で例外が発生した場合も必ずクーポンを解放できるよう、
    // この区間全体を try/catch で囲む。
    let couponDeliveryId: string | null = attempt.couponDeliveryId;
    let couponDiscountAmountFinal = attempt.couponDiscountAmount;
    let result: { orderId: string; error: string | null; outcomeUnknown?: boolean };
    try {
      if (selectedCoupon && !couponDeliveryId) {
        const applyRes = await authFetch("/api/coupons/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            couponId: selectedCoupon.couponId,
            userId,
            storeId: storeIdForOrder,
            subtotal,
            productIds: cartItems.map((i) => i.productId).filter(Boolean),
          }),
        });
        if (!applyRes.ok) {
          saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, null);
          submittingRef.current = false;
          setSubmitting(false);
          setSelectedCoupon(null);
          setSubmitError("クーポンをご利用いただけませんでした。お手数ですが再度お試しください。");
          return;
        }
        const applyData = await applyRes.json();
        couponDeliveryId = applyData.deliveryId;
        couponDiscountAmountFinal = applyData.discountAmount;
        attempt = { ...attempt, couponDeliveryId, couponDiscountAmount: couponDiscountAmountFinal };
        saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, attempt);
      }

      const totalWithCoupon = Math.max(0, subtotal - usedPoints - couponDiscountAmountFinal) + shippingFee;

      // EC注文は常にサーバーAPI経由。EC はクレジットカード払いのみで、金額の確定・PAY.JP 課金は
      // サーバー側で行う（画面表示の合計を expectedTotal として渡し、一致しない場合は課金されない）。
      // 失敗時のクーポン予約の解放もサーバー側で行われる。
      console.log("[ec-confirm] create-order 開始, amount:", totalWithCoupon);
      let res: Response | null = null;
      try {
        res = await authFetch("/api/ec/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRequestId: attempt.requestId,
            storeId: storeIdForOrder,
            customerId: userId ?? null,
            items: cartItems,
            expectedTotal: totalWithCoupon,
            discountAmount: usedPoints,
            couponId: selectedCoupon?.couponId ?? null,
            couponDeliveryId,
            notes: notesStr,
            shippingAddress,
            deliveryTimeSlot: deliveryTime,
            guestEmail: guestEmailVal,
            customerName: `${lastName} ${firstName}`.trim() || null,
          }),
        });
      } catch {
        res = null;
      }
      const json = res ? await res.json().catch(() => null) : null;
      if (res?.ok && json?.orderId) {
        result = { orderId: json.orderId, error: null };
      } else if (!json || json.code === "order_in_progress") {
        // 応答が届かなかった・別の要求が処理中: 注文が作成されたか分からないため、同じ試行のまま再送してもらう
        result = { orderId: "", error: json?.error || "通信エラーが発生しました。もう一度「注文を確定する」を押してください。", outcomeUnknown: true };
      } else {
        result = { orderId: "", error: json.error || "注文の作成に失敗しました" };
      }
    } catch (e: any) {
      if (couponDeliveryId) await releaseCoupon(couponDeliveryId);
      saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, null);
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError(e?.message || "注文処理中にエラーが発生しました");
      return;
    }

    submittingRef.current = false;
    setSubmitting(false);
    console.log("[ec-confirm] create-order →", result);
    if (result.error) {
      // 失敗が確定した場合（サーバー側で注文・クーポン予約は取り消し済み）は次回は新しい試行にする
      if (!result.outcomeUnknown) {
        if (couponDeliveryId) await releaseCoupon(couponDeliveryId);
        saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, null);
      }
      setSubmitError(result.error);
      return;
    }
    saveCheckoutAttempt(CHECKOUT_ATTEMPT_KEY, null);

    // ポイントの利用・付与はサーバー側で注文確定時に反映済み。ここでは電話番号のみ保存し、表示用にポイントを再取得する
    if (userId) {
      if (phone.trim()) {
        await supabase.from("users").update({ phone: phone.trim() }).eq("id", userId);
      }
      await refreshPoints();
    }

    // 印刷用にカートデータを保持してからクリア
    setOrderedItems([...cartItems]);
    setOrderDateTime(new Date());
    setOrderedSubtotal(subtotal);
    setOrderedShippingFee(shippingFee);
    setOrderedUsedPoints(usedPoints);
    setOrderedTotal(total);

    clearCart();
    sessionStorage.removeItem("ec_shipping_address");
    sessionStorage.removeItem("ec_delivery_time");
    sessionStorage.removeItem("ec_customer_last_name");
    sessionStorage.removeItem("ec_customer_first_name");
    sessionStorage.removeItem("ec_customer_phone");
    sessionStorage.removeItem("ec_customer_email");
    sessionStorage.removeItem("ec_selected_coupon_delivery_id");
    // 決済専用に作成したゲストユーザーは注文完了後に破棄し、次回訪問時は新規ゲスト扱いに戻す
    try {
      if (sessionStorage.getItem("patimoba_guest_user_id") === userId) {
        setGuestUserId(null);
      }
    } catch { /* ignore */ }

    // LINEミニアプリ経由でログイン済みの場合はテイクアウトと同様にLINE通知、
    // 通常リンク経由のゲストの場合は従来通りメールで通知する
    if (user?.raw?.line_user_id) {
      try { sessionStorage.removeItem("patimoba_notification_token"); } catch { /* ignore */ }
      (async () => {
        let serviceMessageSent = false;
        try {
          // 注文フローを開始した一覧LIFF(ログインに実際使ったチャネル)を優先する。
          // 無い場合のみ店舗固有liff_idにフォールバック(他店舗やsessionStorageの
          // キャッシュの使い回しはしない)
          const orderLiffId = (() => { try { return sessionStorage.getItem("patimoba_ec_order_liff_id"); } catch { return null; } })();
          const liffId = orderLiffId || (selectedStoreId ? await getStoreLiffIdStrict(selectedStoreId) : "");
          const liff = (await import("@line/liff")).default;
          if (liffId) {
            // liff.init() が解決も拒否もせずハングするケースがあるため、注文完了後の画面を
            // いつまでも止めないよう一定時間でタイムアウトさせる（app/page.tsx と同じ対策）
            await Promise.race([
              liff.init({ liffId }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("liff_init_timeout")), 8000)),
            ]);
          }
          const liffAccessToken = liff.getAccessToken();
          if (liffAccessToken) {
            const tokenRes = await authFetch("/api/line/issue-notification-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: result.orderId, liffAccessToken, ...(orderLiffId ? { sourceLiffId: orderLiffId } : {}) }),
            });
            if (tokenRes.ok) {
              const { notificationToken } = await tokenRes.json();
              const sendRes = await authFetch("/api/line/send-service-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: result.orderId, notificationToken, ...(orderLiffId ? { sourceLiffId: orderLiffId } : {}) }),
              });
              serviceMessageSent = sendRes.ok;
            }
          }
        } catch { /* LIFF未初期化時はスキップ */ }

        if (!serviceMessageSent) {
          authFetch("/api/line/send-order-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: result.orderId }),
          }).catch(() => {});
        }
      })();
    } else {
      // メール本文・宛先はサーバー側で注文データ（DB）から組み立てる
      authFetch("/api/email/send-ec-order-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: result.orderId }),
      })
        .then(async (r) => {
          const data = await r.json();
          console.log("[メール送信]", r.status, data);
        })
        .catch((e) => console.error("[メール送信エラー]", e));
    }

    setShowOrderComplete(true);
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          router.push(selectedStoreId ? `/customer/ec/products?store=${selectedStoreId}` : "/customer/ec");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handlePointChange = () => { console.log("[ec-confirm] ポイント変更 確定, option:", tempPointOption); setPointOption(tempPointOption); setShowPointModal(false); };
  const pointLabel = pointOption === "none" ? "利用なし" : `${usedPoints}ポイント利用`;

  const fmtAddress = (a: ShippingAddress) =>
    `〒${a.postalCode} ${a.prefecture}${a.city}${a.address}${a.building ? " " + a.building : ""}`;

  return (
    <div className="min-h-screen bg-[var(--ec-bg,#ffffff)]">
      <CustomerHeader
        shopName={selectedStoreName || "パティモバ"}
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        logoUrl={storeLogoUrl}
        points={userPoints}
        showCart
      />

      <div className="px-4 pt-2">
        <Link href="/customer/ec/shipping" className="inline-flex items-center text-gray-600 mb-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <div className="px-4 md:px-8 pb-10 md:max-w-2xl md:mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold">注文内容の確認</h2>
          <p className="text-xs text-gray-600 mt-0.5">まだ注文は確定していません</p>
        </div>

        {/* お名前 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">お名前(カタカナ)</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
              placeholder="セイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] placeholder:text-gray-300" />
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              placeholder="メイ"
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] placeholder:text-gray-300" />
          </div>
        </div>

        {/* 電話番号 */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">電話番号</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="09012345678"
            maxLength={11}
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] placeholder:text-gray-300" />
          <p className="text-xs text-gray-600 mt-1">※日中に連絡の取れる電話番号</p>
        </div>

        {/* メールアドレス（注文確認メールをお送りするため、ログイン有無に関わらず必須） */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-bold">メールアドレス</span>
            <span className="text-xs text-red-500 font-bold">必須</span>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)] placeholder:text-gray-300" />
          <p className="text-xs text-gray-600 mt-1">※注文確認・発送通知をお送りします</p>
        </div>

        {/* ポイント利用 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">ポイント利用</span>
            <button onClick={() => { setTempPointOption(pointOption); setShowPointModal(true); }}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
              変更
            </button>
          </div>
          <p className="text-sm text-gray-700">{pointLabel}</p>
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">ご利用可能ポイント </span>
            <span className="text-red-500 font-bold">{availablePoints}</span>
            <span className="text-red-500"> ポイント</span>
          </p>
        </div>

        {/* クーポン利用 */}
        {couponEligibility.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold">クーポン</span>
              <button onClick={() => setShowCouponModal(true)}
                className="text-xs border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
                {selectedCoupon ? "変更" : "選ぶ"}
              </button>
            </div>
            {selectedCoupon ? (
              <p className="text-sm text-gray-700">{selectedCoupon.title}</p>
            ) : couponEligibility.some((c) => c.eligible) ? (
              <p className="text-sm text-amber-600 font-bold">利用可能なクーポンがあります</p>
            ) : (
              <p className="text-sm text-gray-700">利用しない</p>
            )}
          </div>
        )}

        {/* お支払い方法 */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-2">お支払い方法</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">クレジットカード</span>
          </div>
        </div>

        {/* カード情報 */}
        <div className="mb-4">
          <button type="button" onClick={() => {
            console.log("[ec-confirm] カード情報登録ボタン clicked");
            sessionStorage.setItem("patimoba_tds_return_path", "/customer/ec/confirm");
            router.push("/customer/payment/card");
          }}
            className={`w-full border-2 font-bold py-2.5 rounded-md text-sm flex items-center justify-center gap-1 transition-colors ${hasCardInfo ? "border-green-400 text-green-600 hover:bg-green-50" : "border-[var(--ec-400,#fbbf24)] text-[var(--ec-500,#f59e0b)] hover:bg-[var(--ec-50,#fffbeb)]"}`}>
            {hasCardInfo ? `✓ ${cardLabel || "カード情報登録済み"}（変更する）` : "＋ カード情報を登録する"}
          </button>
          {!hasCardInfo && (
            <p className="text-xs text-red-500 mt-1.5">カード情報を登録しないと注文を確定できません</p>
          )}
        </div>

        {/* お届け先 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">お届け先</span>
            <Link href="/customer/ec/shipping" className="text-xs text-[var(--ec-600,#d97706)] underline">変更</Link>
          </div>
          {shippingAddress ? (
            <p className="text-sm text-gray-700 leading-relaxed">{fmtAddress(shippingAddress)}</p>
          ) : (
            <p className="text-sm text-gray-600">未入力</p>
          )}
        </div>

        {/* 配送時間帯 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">配送時間帯</span>
          </div>
          <div className="space-y-2">
            {deliveryTimeSlots.map((slot) => (
              <button key={slot} type="button" onClick={() => setDeliveryTime(slot)}
                className={`w-full text-left px-4 py-2.5 rounded-lg border-2 text-sm transition-colors ${
                  deliveryTime === slot
                    ? "border-[var(--ec-400,#fbbf24)] bg-[var(--ec-50,#fffbeb)] text-[var(--ec-700,#b45309)] font-medium"
                    : "border-gray-200 text-gray-600 hover:border-[var(--ec-200,#fde68a)]"
                }`}>
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* 注文商品 + 合計 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <ShoppingBag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">注文商品・金額</span>
          </div>
          <div className="divide-y divide-gray-100">
            {cartItems.map((item, idx) => {
              const c = item.customization;
              const lineTotal = calcItemSubtotal(item);
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
                    {c?.noshi && (
                      <p className="text-xs text-gray-500">
                        のし：{c.noshi.name}{c.noshi.purpose && `（${c.noshi.purpose}）`}{c.noshi.displayName && `「${c.noshi.displayName}」`}
                      </p>
                    )}
                    {c?.messagePlateOption && (
                      <p className="text-xs text-gray-500">
                        メッセージプレート：{c.messagePlateOption.name}{c.messagePlate && `「${c.messagePlate}」`}
                        {c.messagePlateOption.price > 0 && `（+¥${(c.messagePlateOption.price * item.quantity).toLocaleString()}）`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c?.messagePlateOption && c.messagePlateOption.price > 0 && (
                      <p className="text-xs text-gray-500">商品 ¥{(item.price * item.quantity).toLocaleString()}</p>
                    )}
                    <p className="text-sm font-bold">¥{lineTotal.toLocaleString()}</p>
                    {item.quantity > 1 && <p className="text-xs text-gray-600">×{item.quantity}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-sm">{subtotal.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">配送料</span>
              <span className="text-sm">
                {shippingFeeStatus === "loading" ? "計算中..." : shippingFee === 0 ? "無料" : `${shippingFee.toLocaleString()}円`}
              </span>
            </div>
            {shippingFeeStatus === "error" && (
              <p className="text-xs text-red-500">
                送料を計算できませんでした。
                <button type="button" onClick={() => setShippingFeeReloadKey((k) => k + 1)} className="underline ml-1">再計算する</button>
              </p>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">ポイント利用</span>
              <span className="text-sm text-gray-500">{pointLabel}</span>
            </div>
            {selectedCoupon && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">クーポン割引</span>
                <span className="text-sm text-gray-500">-{couponDiscountAmount.toLocaleString()}円</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2 border-t border-gray-200">
              <span className="text-sm font-bold">支払い金額</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                <span className="text-base ml-0.5">円</span>
              </div>
            </div>
            {nearMissCoupon && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                あと{(nearMissCoupon.minOrderAmount! - subtotal).toLocaleString()}円でご利用可能なクーポンがあります
              </p>
            )}
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

        {submitError && <p className="text-xs text-red-500 text-center mb-2">{submitError}</p>}

        <div className="flex gap-3 mb-8">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => router.push(selectedStoreId ? `/customer/ec/products?store=${selectedStoreId}` : "/customer/ec")}
            className="flex-1 border-2 border-[var(--ec-400,#fbbf24)] text-[var(--ec-500,#f59e0b)] font-bold py-3 rounded-md text-sm hover:bg-[var(--ec-50,#fffbeb)] transition-colors">
            買い物を続ける
          </motion.button>
          <motion.button
            whileHover={submitting || shippingFeeStatus !== "ready" || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim() || !email.trim() ? undefined : { scale: 1.02 }}
            whileTap={submitting || shippingFeeStatus !== "ready" || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim() || !email.trim() ? undefined : { scale: 0.98 }}
            onClick={handleConfirmOrder}
            disabled={submitting || shippingFeeStatus !== "ready" || !hasCardInfo || !lastName.trim() || !firstName.trim() || !phone.trim() || !email.trim()}
            className="flex-1 bg-[var(--ec-400,#fbbf24)] hover:bg-[var(--ec-500,#f59e0b)] disabled:bg-[var(--ec-200,#fde68a)] disabled:cursor-not-allowed text-[var(--ec-button-text,#ffffff)] font-bold py-3 rounded-md text-sm transition-colors">
            {submitting ? "処理中..." : "注文を確定する"}
          </motion.button>
        </div>
      </div>

      {/* ポイント変更モーダル */}
      <AnimatePresence>
        {showPointModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]" onClick={() => setShowPointModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-6">
              <button onClick={() => setShowPointModal(false)} className="absolute top-4 right-4 text-gray-600">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-base font-bold">利用可能ポイント</span>
                <span className="text-3xl font-bold text-red-500">{availablePoints}</span>
              </div>
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "partial"}
                    onChange={() => setTempPointOption("partial")} className="w-5 h-5 accent-[var(--ec-500,#f59e0b)]" />
                  <span className="text-sm">一部のポイントを使う</span>
                </label>
                {tempPointOption === "partial" && (
                  <input type="number" value={partialPoints} onChange={(e) => setPartialPoints(e.target.value)}
                    placeholder="利用するポイント数"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ec-400,#fbbf24)]"
                    max={Math.min(availablePoints, subtotal)} />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "all"}
                    onChange={() => setTempPointOption("all")} className="w-5 h-5 accent-[var(--ec-500,#f59e0b)]" />
                  <span className="text-sm">全部のポイントを使う</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="ec-pts" checked={tempPointOption === "none"}
                    onChange={() => setTempPointOption("none")} className="w-5 h-5 accent-[var(--ec-500,#f59e0b)]" />
                  <span className="text-sm">ポイントを利用しない</span>
                </label>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePointChange}
                className="w-full bg-[var(--ec-400,#fbbf24)] hover:bg-[var(--ec-500,#f59e0b)] text-[var(--ec-button-text,#ffffff)] font-bold py-3 rounded-full text-sm">
                変更する
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* クーポン選択モーダル */}
      <AnimatePresence>
        {showCouponModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]" onClick={() => setShowCouponModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[20%] bg-white rounded-2xl shadow-2xl z-[70] p-6 max-h-[60vh] overflow-y-auto">
              <button onClick={() => setShowCouponModal(false)} className="absolute top-4 right-4 text-gray-600">
                <X className="w-5 h-5" />
              </button>
              <p className="text-base font-bold text-center mb-4">クーポンを選ぶ</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer border border-gray-200 rounded-lg px-3 py-2.5">
                  <input type="radio" name="ec-coupon" checked={!selectedCoupon}
                    onChange={() => { setSelectedCoupon(null); setShowCouponModal(false); }}
                    className="w-5 h-5 accent-[var(--ec-500,#f59e0b)]" />
                  <span className="text-sm">利用しない</span>
                </label>
                {couponEligibility.map((c) => (
                  <label key={c.deliveryId}
                    className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${c.eligible ? "cursor-pointer border-gray-200" : "opacity-50 border-gray-100"}`}>
                    <input type="radio" name="ec-coupon" disabled={!c.eligible}
                      checked={selectedCoupon?.deliveryId === c.deliveryId}
                      onChange={() => { setSelectedCoupon(c); setShowCouponModal(false); }}
                      className="w-5 h-5 accent-[var(--ec-500,#f59e0b)]" />
                    <span className="text-sm flex-1">
                      {c.title}
                      <span className="block text-xs text-gray-900 mt-0.5">
                        {c.eligible ? couponEligibleLabel(c, subtotal) : c.reason}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 印刷用レシート（画面上は非表示、印刷時のみ表示） */}
      <PrintReceipt
        customerName={`${lastName} ${firstName}`.trim()}
        lineName={profile?.lineName}
        phone={phone}
        orderDateTime={orderDateTime}
        deliveryTime={deliveryTime}
        items={orderedItems}
        subtotal={orderedSubtotal}
        shippingFee={orderedShippingFee}
        usedPoints={orderedUsedPoints}
        total={orderedTotal}
        storeName={selectedStoreName || "パティモバ"}
      />

      {/* 注文完了モーダル */}
      <AnimatePresence>
        {showOrderComplete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60]" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-6 right-6 top-[25%] bg-white rounded-2xl shadow-2xl z-[70] p-8 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-[var(--ec-100,#fef3c7)] flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-[var(--ec-500,#f59e0b)]" />
                </div>
              </div>
              <p className="text-base font-bold mb-2">ご注文ありがとうございます！</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-1">
                {user?.raw?.line_user_id
                  ? "注文情報がLINEに届いています。"
                  : "注文情報がご入力いただいたメールアドレスに届いています。"}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                準備が整い次第発送いたします。
              </p>
              <p className="text-xs text-gray-600 mb-4">{countdown}秒後に自動で商品一覧に戻ります</p>
              {user?.raw?.line_user_id && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); router.push("/customer/orders"); }}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-full text-base transition-colors mb-3">
                  <ClipboardCheck className="w-5 h-5" />
                  注文履歴を確認する
                </motion.button>
              )}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => {
                  console.log("[ec-confirm] 商品一覧に戻るボタン clicked");
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  router.push(selectedStoreId ? `/customer/ec/products?store=${selectedStoreId}` : "/customer/ec");
                }}
                className="w-full bg-[var(--ec-400,#fbbf24)] hover:bg-[var(--ec-500,#f59e0b)] text-[var(--ec-button-text,#ffffff)] font-bold py-3 rounded-full text-base">
                商品一覧に戻る
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
