"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { CartModal } from "@/components/customer/cart-modal";
import type { CartItem } from "@/components/customer/cart-modal";
import { useProduct } from "@/hooks/use-products";
import { useCustomerContext } from "@/lib/customer-context";
import { Product } from "@/lib/types";

const ecSteps = ["店舗選択", "商品選択", "配送先", "注文確認"];

export default function ECProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedStoreName } = useCustomerContext();
  const { product, loading } = useProduct(params.id as string);
  const [quantity, setQuantity] = useState(1);
  const [showQuantityDropdown, setShowQuantityDropdown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!product) return null;

  const handleAddToCart = () => {
    const existing = cartItems.find((item) => item.id === product.id);
    if (existing) {
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity,
        },
      ]);
    }

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setShowCart(true);
    }, 1200);
  };

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader
        shopName={selectedStoreName || "パティモバ"}
        showCart
        cartCount={totalCartItems}
      />

      <div className="px-4 pt-2">
        <Link
          href="/customer/ec/products"
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <StepProgress currentStep={2} steps={ecSteps} />

      <div className="px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] mb-4"
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>

          <p className="text-gray-600 text-sm mt-3 whitespace-pre-line leading-relaxed">
            {product.description}
          </p>

          <p className="mt-4">
            <span className="text-3xl font-bold text-gray-900">
              {product.price.toLocaleString()}
            </span>
            <span className="text-lg text-gray-900 ml-0.5">円</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">* 配送料は別途かかります</p>

          <div className="mt-4 relative">
            <button
              onClick={() => setShowQuantityDropdown(!showQuantityDropdown)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-left text-sm bg-white flex items-center justify-between"
            >
              <span className="text-gray-500">{quantity}</span>
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showQuantityDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowQuantityDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1"
                >
                  {Array.from(
                    { length: product.maxQuantity },
                    (_, i) => i + 1
                  ).map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setQuantity(num);
                        setShowQuantityDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-2"
                    >
                      {quantity === num && (
                        <span className="text-gray-900">&#10003;</span>
                      )}
                      <span>{num}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddToCart}
            className="w-full mt-6 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3.5 rounded-full text-base transition-colors"
          >
            カートに追加
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl px-10 py-8">
              <p className="text-lg font-bold text-gray-900">カートに追加されました</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <CartModal
            items={cartItems}
            onClose={() => setShowCart(false)}
            onUpdateQuantity={(id, qty) =>
              setCartItems((prev) =>
                prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
              )
            }
            onRemove={(id) =>
              setCartItems((prev) => prev.filter((item) => item.id !== id))
            }
            onProceed={() => router.push("/customer/ec/shipping")}
            proceedLabel="配送先を入力する"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
