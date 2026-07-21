function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** hexをtargetHex方向にweight(0〜1)だけ線形補間する */
export function mix(hex: string, targetHex: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(targetHex)
  return rgbToHex(
    r1 + (r2 - r1) * weight,
    g1 + (g2 - g1) * weight,
    b1 + (b2 - b1) * weight
  )
}

/** baseHexを400番相当として、Tailwindのamber-50〜700に近い濃淡8段階を生成する */
export function shadeScale(baseHex: string): Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700, string> {
  return {
    50: mix(baseHex, "#ffffff", 0.92),
    100: mix(baseHex, "#ffffff", 0.85),
    200: mix(baseHex, "#ffffff", 0.65),
    300: mix(baseHex, "#ffffff", 0.35),
    400: baseHex,
    500: mix(baseHex, "#000000", 0.12),
    600: mix(baseHex, "#000000", 0.25),
    700: mix(baseHex, "#000000", 0.38),
  }
}

/** hexの背景に対して読みやすい文字色（黒 or 白）を返す */
export function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#111827" : "#ffffff"
}
