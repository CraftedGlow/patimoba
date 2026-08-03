import { regionForPrefecture, isSpecialRegion } from "@/lib/constants/regions"

export interface ShippingSettings {
  mode: "flat" | "region"
  flatFee: number
  originRegion: string | null
  freeShippingEnabled: boolean
  freeShippingThreshold: number | null
  freeShippingExcludesSpecialRegions: boolean
  remoteSurcharge: number
}

export interface RegionRate {
  destinationRegion: string
  fee: number
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  mode: "flat",
  flatFee: 0,
  originRegion: null,
  freeShippingEnabled: false,
  freeShippingThreshold: null,
  freeShippingExcludesSpecialRegions: true,
  remoteSurcharge: 0,
}

export interface ShippingSettingsRow {
  mode: string
  flat_fee: number
  origin_region: string | null
  free_shipping_enabled: boolean
  free_shipping_threshold: number | null
  free_shipping_excludes_special_regions: boolean
  remote_surcharge: number
}

/** store_shipping_settings の行を ShippingSettings に変換する。クライアント・サーバー共通で使う。 */
export function shippingSettingsFromRow(row: ShippingSettingsRow): ShippingSettings {
  return {
    mode: row.mode === "region" ? "region" : "flat",
    flatFee: row.flat_fee,
    originRegion: row.origin_region,
    freeShippingEnabled: row.free_shipping_enabled,
    freeShippingThreshold: row.free_shipping_threshold,
    freeShippingExcludesSpecialRegions: row.free_shipping_excludes_special_regions,
    remoteSurcharge: row.remote_surcharge,
  }
}

/**
 * 配送料を計算する。クライアント（表示用）・サーバー（確定用）の両方から
 * 同じロジックを呼ぶことで計算式のズレを防ぐ。
 */
export function calculateShippingFee(params: {
  settings: ShippingSettings
  rates: RegionRate[]
  destinationPrefecture: string
  subtotal: number
}): number {
  const { settings, rates, destinationPrefecture, subtotal } = params
  const special = isSpecialRegion(destinationPrefecture)

  let fee: number
  if (settings.mode === "region") {
    const destinationRegion = regionForPrefecture(destinationPrefecture)
    const match = destinationRegion
      ? rates.find((r) => r.destinationRegion === destinationRegion)
      : undefined
    fee = match ? match.fee : settings.flatFee
  } else {
    fee = settings.flatFee
    if (special) fee += settings.remoteSurcharge
  }

  const freeShippingApplies =
    settings.freeShippingEnabled &&
    settings.freeShippingThreshold != null &&
    subtotal >= settings.freeShippingThreshold &&
    !(special && settings.freeShippingExcludesSpecialRegions)

  return freeShippingApplies ? 0 : fee
}
