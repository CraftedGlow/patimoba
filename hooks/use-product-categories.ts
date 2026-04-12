"use client"

import { PRODUCT_CATEGORIES } from "@/lib/constants/product-master"

export interface ProductCategory {
  id: string
  storeId: string
  name: string
  sortOrder: number
}

export function useProductCategories(_storeId?: string) {
  const categories: ProductCategory[] = PRODUCT_CATEGORIES.map((c) => ({
    ...c,
    storeId: "",
  }))

  return { categories, loading: false, error: null, refetch: () => {} }
}
