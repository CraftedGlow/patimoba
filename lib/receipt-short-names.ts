type CustomOptionGroup = {
  name: string
  values: { label: string; print_short_name?: string }[]
}

/**
 * order_item_options の1行について、印刷用の名前を解決する。
 * decoration_id/product_id（注文時点で選ばれたデコレーション/商品への参照）があれば
 * 現在の短縮名を優先し、なければ注文時点のスナップショット→フルネームの順にフォールバックする。
 */
export function resolveOptionPrintName(
  opt: {
    decoration_id?: string | null
    product_id?: string | null
    option_group_name_snapshot?: string | null
    option_item_name_snapshot?: string | null
    option_item_short_name_snapshot?: string | null
  },
  decorationShortNameMap: Map<string, string | null>,
  productCustomOptionsMap: Map<string, CustomOptionGroup[] | null>
): string {
  const fallback = opt.option_item_short_name_snapshot || opt.option_item_name_snapshot || ""

  if (opt.decoration_id) {
    const current = decorationShortNameMap.get(opt.decoration_id)
    if (current) return current
  } else if (opt.product_id) {
    const groups = productCustomOptionsMap.get(opt.product_id)
    const group = groups?.find((g) => g.name === opt.option_group_name_snapshot)
    if (group) {
      const labels = (opt.option_item_name_snapshot || "").split("、")
      const resolved = labels.map((label) => group.values.find((v) => v.label === label)?.print_short_name || label)
      if (resolved.some((r, i) => r !== labels[i])) return resolved.join("、")
    }
  }

  return fallback
}
