import type { CSSProperties } from "react"
import { contrastText, shadeScale } from "./color-utils"

export interface EcThemeColors {
  ec_header_color?: string | null
  ec_button_color?: string | null
  ec_background_color?: string | null
}

/**
 * 店舗のカラー設定からCSS変数を組み立てる。
 * 未設定の色は変数自体を出さない（各Tailwindクラス側のフォールバック値で現状の配色を維持するため）。
 */
export function buildEcThemeVars(store: EcThemeColors | null | undefined): CSSProperties {
  const vars: Record<string, string> = {}

  if (store?.ec_header_color) {
    vars["--ec-header"] = store.ec_header_color
    vars["--ec-header-text"] = contrastText(store.ec_header_color)
  }

  if (store?.ec_background_color) {
    vars["--ec-bg"] = store.ec_background_color
  }

  if (store?.ec_button_color) {
    const scale = shadeScale(store.ec_button_color)
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700] as const) {
      vars[`--ec-${shade}`] = scale[shade]
    }
    vars["--ec-button-text"] = contrastText(store.ec_button_color)
  }

  return vars as CSSProperties
}
