"use client"

import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import {
  PRODUCT_CUSTOM_OPTION_PRESET_METAS,
  isPresetGroupPresent,
} from "@/lib/constants/product-custom-option-presets"
import type { ProductCustomOption } from "@/lib/types"

type Props = {
  customOptions: ProductCustomOption[]
  onAdd: (option: ProductCustomOption) => void
  /** コンパクト表示（商品編集パネル向け） */
  compact?: boolean
  className?: string
}

export function ProductCustomOptionPresetChips({
  customOptions,
  onAdd,
  compact,
  className = "",
}: Props) {
  return (
    <div className={className}>
      <p
        className={
          compact
            ? "text-[11px] text-gray-500 mb-1.5"
            : "text-xs text-gray-600 mb-2 font-medium"
        }
      >
        定番オプション（タップで追加）
      </p>
      <div className="flex flex-wrap gap-2">
        {PRODUCT_CUSTOM_OPTION_PRESET_METAS.map((meta) => {
          const present = isPresetGroupPresent(customOptions, meta.defaultGroupName)
          return (
            <motion.button
              key={meta.id}
              type="button"
              whileHover={present ? undefined : { scale: 1.03 }}
              whileTap={present ? undefined : { scale: 0.97 }}
              disabled={present}
              onClick={() => onAdd(meta.create())}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                present
                  ? "border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400"
              }`}
            >
              {!present && <Plus className="w-3.5 h-3.5 shrink-0" />}
              {meta.label}
              {present && <span className="text-[10px] font-normal">追加済</span>}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
