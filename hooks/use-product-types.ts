"use client"

import { PRODUCT_TYPES } from "@/lib/constants/product-master"

export interface ProductType {
  id: string
  productType: string
  typeCode: number
}

export function useProductTypes() {
  const productTypes: ProductType[] = PRODUCT_TYPES
  const categories = ["すべて", ...productTypes.map((t) => t.productType)]

  return { productTypes, categories, loading: false, error: null, refetch: () => {} }
}
