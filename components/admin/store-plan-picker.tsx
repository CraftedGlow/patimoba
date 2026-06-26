"use client";

import { motion } from "framer-motion";
import {
  PLAN_OPTIONS,
  PLAN_ADDONS,
  type StorePlanSlug,
} from "@/lib/store-plans";

export function StorePlanPicker({
  value,
  onChange,
  selectedAddons = [],
  onAddonsChange,
}: {
  value: StorePlanSlug;
  onChange: (plan: StorePlanSlug) => void;
  selectedAddons?: string[];
  onAddonsChange?: (addons: string[]) => void;
}) {
  const toggleAddon = (id: string) => {
    if (!onAddonsChange) return;
    onAddonsChange(
      selectedAddons.includes(id)
        ? selectedAddons.filter((a) => a !== id)
        : [...selectedAddons, id]
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_OPTIONS.map((opt, i) => {
          const selected = value === opt.slug;
          return (
            <motion.button
              key={opt.slug}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 28 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(opt.slug)}
              className={`text-left border-2 rounded-xl p-5 transition-colors relative min-h-[180px] ${
                selected
                  ? "border-amber-500 bg-amber-50/50 shadow-md ring-1 ring-amber-200/60"
                  : "border-gray-200 hover:border-amber-200"
              }`}
            >
              {opt.badge && (
                <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {opt.badge}
                </span>
              )}
              <p className={`font-bold text-base mb-1 ${opt.accentClass}`}>{opt.label}</p>
              <p className="text-xl font-bold">
                {opt.priceYen === 0 ? "月額無料" : `月額 ${opt.priceYen.toLocaleString("ja-JP")}円`}
              </p>
              <div className="flex flex-col gap-0.5 mt-1 mb-3">
                <p className="text-xs text-gray-500">
                  注文手数料 <span className="font-bold text-gray-700">{opt.orderFeePercent}%</span>
                </p>
                <p className="text-xs text-gray-500">
                  決済手数料 <span className="font-bold text-gray-700">{opt.paymentFeePercent}%</span>
                </p>
              </div>
              <ul className="space-y-1.5">
                {opt.features.map((f) => (
                  <li key={f} className="text-xs text-gray-600">
                    ・{f}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      {onAddonsChange && (
        <div className="border border-dashed border-gray-300 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-700 mb-3">
            オプション機能（プランに関係なく追加可）
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLAN_ADDONS.map((addon) => {
              const checked = selectedAddons.includes(addon.id);
              return (
                <label
                  key={addon.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "border-amber-400 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddon(addon.id)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{addon.label}</span>
                      <span className="text-xs text-amber-700 font-bold whitespace-nowrap">
                        +{addon.priceYen.toLocaleString()}円/月
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {selectedAddons.length > 0 && (
            <p className="text-xs text-amber-700 mt-3 font-bold">
              オプション合計: +
              {PLAN_ADDONS.filter((a) => selectedAddons.includes(a.id))
                .reduce((s, a) => s + a.priceYen, 0)
                .toLocaleString()}
              円/月
            </p>
          )}
        </div>
      )}
    </div>
  );
}
