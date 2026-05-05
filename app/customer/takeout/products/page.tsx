"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { useProductRegistrations, type ProductRegistration } from "@/hooks/use-product-registrations";
import { useWholeCakes } from "@/hooks/use-whole-cakes";
import type { WholeCakeProduct } from "@/lib/types";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

function ProductBadge({ product }: { product: ProductRegistration }) {
  const isLimited = !!(product.limited_from || product.limited_until);
  const isSameDayOnly = !product.is_active && product.same_day_order_allowed;
  if (isLimited) {
    return (
      <span className="absolute top-2 left-2 text-white text-[10px] font-bold px-2.5 py-1 rounded leading-none" style={{ backgroundColor: "#fe85e0" }}>
        期間限定
      </span>
    );
  }
  if (isSameDayOnly) {
    return (
      <span className="absolute top-2 left-2 text-white text-[10px] font-bold px-2.5 py-1 rounded leading-none" style={{ backgroundColor: "#febc2f" }}>
        本日限定
      </span>
    );
  }
  return null;
}

function RegistrationCard({ product, basePath }: { product: ProductRegistration; basePath: string }) {
  const href = `${basePath}/product/${product.id}`;

  return (
    <Link href={href}>
      <motion.div
        className="group cursor-pointer"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
          <ProductBadge product={product} />
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-gray-900">
          &yen;{product.base_price.toLocaleString()}
        </p>
      </motion.div>
    </Link>
  );
}

function PrintDecorationCard({ price }: { price: number }) {
  return (
    <Link href="/customer/takeout/whole-cake?mode=print">
      <motion.div className="group cursor-pointer" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <img src="/print-decoration-default.jpg" alt="プリントデコレーション" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute top-2 left-2 text-white text-[10px] font-bold px-2.5 py-1 rounded leading-none" style={{ backgroundColor: "#f59e0b" }}>
            ホールケーキ
          </span>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">プリントデコレーション</h3>
        <p className="text-sm text-amber-600 font-bold">+&yen;{price.toLocaleString()}〜</p>
      </motion.div>
    </Link>
  );
}

function WholeCakeCard({ cake }: { cake: WholeCakeProduct }) {
  const fromPrice = cake.sizes.length
    ? Math.min(...cake.sizes.map((s) => Number(s.price) || 0))
    : 0;

  return (
    <Link href={`/customer/takeout/whole-cake?cakeId=${cake.id}`}>
      <motion.div
        className="group cursor-pointer"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          {cake.image ? (
            <img
              src={cake.image}
              alt={cake.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
          <span className="absolute top-2 left-2 text-white text-[10px] font-bold px-2.5 py-1 rounded leading-none" style={{ backgroundColor: "#f59e0b" }}>
            ホールケーキ
          </span>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">
          {cake.name}
        </h3>
        <p className="text-sm text-gray-900">
          &yen;{fromPrice.toLocaleString()}〜
        </p>
      </motion.div>
    </Link>
  );
}

export default function TakeoutProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeParam = searchParams.get("store");
  const typeParam = searchParams.get("type");
  const orderTypeParam = typeParam ?? "reservation";
  const { selectedStoreId, selectedStoreName, profile } = useCustomerContext();
  const storeId = selectedStoreId || storeParam || undefined;
  const pickupPath = `/customer/takeout/pickup?store=${storeId ?? ""}&type=${orderTypeParam}`;

  const { products, categories, loading } = useProductRegistrations({
    storeId,
  });
  const { wholeCakes, loading: cakesLoading } = useWholeCakes(storeId);
  const { itemCount } = useCart();

  const [printDecoData, setPrintDecoData] = useState<{ price: number; image: string } | null>(null);

  useEffect(() => {
    if (!storeId || cakesLoading || wholeCakes.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: groups } = await supabase
        .from("decoration_groups")
        .select("id, decoration_group_items(decorations(price))")
        .eq("store_id", storeId)
        .ilike("name", "%プリントデコレーション%")
        .limit(1);
      const group = groups?.[0];
      if (!group || cancelled) return;
      const { data: links } = await supabase
        .from("product_decoration_groups")
        .select("product_id")
        .eq("group_id", group.id);
      const cakeIds = (links ?? []).map((l: any) => String(l.product_id));
      const hasCakes = wholeCakes.some((c) => cakeIds.includes(c.id));
      if (!hasCakes || cancelled) return;
      const price = (group.decoration_group_items as any[])?.[0]?.decorations?.price || 0;
      const firstCake = wholeCakes.find((c) => cakeIds.includes(c.id));
      if (!cancelled) setPrintDecoData({ price, image: "" });
    })();
    return () => { cancelled = true; };
  }, [storeId, cakesLoading, wholeCakes.length]);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const isLimited = (p: ProductRegistration) => !!(p.limited_from || p.limited_until);
  const isSameDayOnly = (p: ProductRegistration) => !p.is_active && p.same_day_order_allowed;
  // ホールケーキ(is_preorder_required)は wholeCakes に出るので除外。ECのみ商品も除外。
  const visibleProducts = (typeParam === "sameday"
    ? products.filter((p) => p.same_day_order_allowed)
    : typeParam === "reservation"
    ? products.filter((p) => p.is_active)
    : products.filter((p) => p.is_active || isSameDayOnly(p))
  ).filter((p) => !p.is_preorder_required && !p.is_ec);

  const limitedProducts = visibleProducts.filter(isLimited);
  const nonLimitedProducts = visibleProducts.filter((p) => !isLimited(p));

  // カテゴリ優先順
  const CATEGORY_ORDER = ["生菓子", "焼き菓子"];
  const knownCategories = new Set(CATEGORY_ORDER);
  const extraCategories = Array.from(new Set(nonLimitedProducts.map((p) => p.category_name).filter(Boolean)))
    .filter((c) => !knownCategories.has(c!)) as string[];
  const orderedCategories = [...CATEGORY_ORDER, ...extraCategories];

  // "すべて"表示用: 期間限定→ホールケーキ→生菓子→焼き菓子→その他 を一本の配列に
  type GridItem =
    | { kind: "product"; data: ProductRegistration }
    | { kind: "wholecake"; data: WholeCakeProduct }
    | { kind: "printdeco"; price: number };

  const allGridItems: GridItem[] = [
    ...limitedProducts.map((p) => ({ kind: "product" as const, data: p })),
    ...wholeCakes.map((c) => ({ kind: "wholecake" as const, data: c })),
    ...(printDecoData ? [{ kind: "printdeco" as const, price: printDecoData.price }] : []),
    ...orderedCategories.flatMap((cat) =>
      nonLimitedProducts.filter((p) => p.category_name === cat).map((p) => ({ kind: "product" as const, data: p }))
    ),
    ...nonLimitedProducts.filter((p) => !p.category_name).map((p) => ({ kind: "product" as const, data: p })),
  ];

  // 特定カテゴリ選択時のフィルタ（"すべて"以外）
  const filtered =
    selectedCategory === "期間限定"
      ? visibleProducts.filter(isLimited)
      : selectedCategory === "ホールケーキ"
      ? []
      : visibleProducts.filter((p) => p.category_name === selectedCategory);

  const visibleWholeCakes =
    selectedCategory === "ホールケーキ" ? wholeCakes : [];

  const displayCategories = (() => {
    // visibleProductsに存在するカテゴリのみ（EC商品カテゴリを除外）、"ホール"はホールケーキと重複するため除外
    const visibleCatSet = new Set(
      visibleProducts.map((p) => p.category_name).filter(Boolean) as string[]
    );
    const base = categories.filter(
      (c) => c === "すべて" || (visibleCatSet.has(c) && c !== "ホール")
    );
    const withLimited = base.includes("期間限定") ? base : [...base, "期間限定"];
    return wholeCakes.length > 0 && !withLimited.includes("ホールケーキ")
      ? [...withLimited, "ホールケーキ"]
      : withLimited;
  })();

  const handleStepClick = (step: number) => {
    if (step === 1) {
      router.push("/customer/takeout");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CustomerHeader
        userName={profile?.lineName}
        avatarUrl={profile?.avatar || undefined}
        points={0}
        onCartClick={() => setCartOpen(true)}
        showBack
      />

      <StepProgress currentStep={2} steps={steps} onStepClick={handleStepClick} />

      <div className="px-4 md:px-8 lg:px-12 pb-8 flex-1" style={{ paddingBottom: itemCount > 0 ? "6rem" : "2rem" }}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-bold text-gray-900">商品一覧</h2>
            <div className="h-1 w-16 bg-amber-400 rounded-full mt-1" />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors"
            >
              {selectedCategory}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50"
                  >
                    {displayCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-2"
                      >
                        {selectedCategory === cat ? (
                          <Check className="w-4 h-4 text-gray-700 flex-shrink-0" />
                        ) : (
                          <span className="w-4 flex-shrink-0" />
                        )}
                        <span className={selectedCategory === cat ? "font-medium text-gray-900" : "text-gray-700"}>
                          {cat}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-right mb-3" style={{ fontSize: 11 }}>表示価格は全て税込です</p>

        {loading || cakesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : selectedCategory === "すべて" ? (
          allGridItems.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">商品が見つかりませんでした</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
              {allGridItems.map((item, i) => (
                <motion.div
                  key={item.kind === "product" ? item.data.id : item.kind === "wholecake" ? `wc-${item.data.id}` : "print-deco"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {item.kind === "product" && <RegistrationCard product={item.data} basePath="/customer/takeout" />}
                  {item.kind === "wholecake" && <WholeCakeCard cake={item.data} />}
                  {item.kind === "printdeco" && <PrintDecorationCard price={item.price} />}
                </motion.div>
              ))}
            </div>
          )
        ) : filtered.length === 0 && visibleWholeCakes.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            商品が見つかりませんでした
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
            {visibleWholeCakes.map((cake, i) => (
              <motion.div key={`wc-${cake.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <WholeCakeCard cake={cake} />
              </motion.div>
            ))}
            {printDecoData && selectedCategory === "ホールケーキ" && (
              <motion.div key="print-deco" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: visibleWholeCakes.length * 0.04 }}>
                <PrintDecorationCard price={printDecoData.price} />
              </motion.div>
            )}
            {filtered.map((product, i) => (
              <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + visibleWholeCakes.length) * 0.04 }}>
                <RegistrationCard product={product} basePath="/customer/takeout" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} proceedPath={pickupPath} />

      {/* カートバナー */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 px-4 py-3">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex-1 flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-500 font-bold py-3 rounded-full text-sm hover:bg-amber-50 transition-colors"
            >
              <span className="absolute -top-2 left-2 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
              カートを見る
            </button>
            <button
              onClick={() => router.push(pickupPath)}
              className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-sm transition-colors"
            >
              日時選択に進む
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
