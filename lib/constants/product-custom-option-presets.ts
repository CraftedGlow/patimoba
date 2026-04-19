import type { ProductCustomOption } from "@/lib/types"
import { CANDLE_OPTIONS } from "./product-master"

export type ProductCustomOptionPresetId =
  | "size"
  | "candles"
  | "message"

export interface ProductCustomOptionPresetMeta {
  id: ProductCustomOptionPresetId
  /** チップに表示する短い名前 */
  label: string
  /** 追加後のオプショングループ名（重複判定に使用） */
  defaultGroupName: string
  create: () => ProductCustomOption
}

export const PRODUCT_CUSTOM_OPTION_PRESET_METAS: ProductCustomOptionPresetMeta[] = [
  {
    id: "size",
    label: "サイズ",
    defaultGroupName: "サイズ",
    create: () => ({
      name: "サイズ",
      type: "single",
      required: true,
      values: [
        { label: "4号（12cm）", additional_price: 0 },
        { label: "5号（15cm）", additional_price: 300 },
        { label: "6号（18cm）", additional_price: 600 },
      ],
    }),
  },
  {
    id: "candles",
    label: "ろうそく",
    defaultGroupName: "ろうそく",
    create: () => ({
      name: "ろうそく",
      type: "multiple",
      required: false,
      values: CANDLE_OPTIONS.map((c) => ({
        label: c.name,
        additional_price: c.price,
      })),
    }),
  },
  {
    id: "message",
    label: "メッセージプレート（入力フォーム）",
    defaultGroupName: "メッセージプレート",
    create: () => ({
      name: "メッセージプレート",
      type: "text",
      required: false,
      values: [],
    }),
  },
]

export function isPresetGroupPresent(
  customOptions: { name: string }[],
  defaultGroupName: string
): boolean {
  return customOptions.some((o) => o.name === defaultGroupName)
}
