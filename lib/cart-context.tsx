"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { UICartItem } from "./types"

interface DeliveryAddress {
  postalCode: string
  prefecture: string
  city: string
  address: string
  building: string
}

export type CartChannel = "ec" | "takeout" | null

interface AddItemResult {
  ok: boolean
  error?: string
}

interface CartContextType {
  items: UICartItem[]
  storeId: string | null
  channel: CartChannel
  total: number
  itemCount: number
  deliveryAddress: DeliveryAddress | null
  shippingFee: number
  usedPoints: number
  addItem: (item: UICartItem) => AddItemResult
  removeItem: (productId: string, customizationKey?: string) => void
  updateQuantity: (productId: string, quantity: number, customizationKey?: string) => void
  clear: () => void
  setDeliveryAddress: (addr: DeliveryAddress | null) => void
  setShippingFee: (fee: number) => void
  setUsedPoints: (points: number) => void
}

function itemChannel(item: UICartItem): CartChannel {
  if (item.isEc) return "ec"
  if (item.isTakeout) return "takeout"
  return null
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const DEFAULT_STORAGE_KEY = "patimoba_cart_v1"

interface PersistedCart {
  items: UICartItem[]
  storeId: string | null
  deliveryAddress: DeliveryAddress | null
  shippingFee: number
  usedPoints: number
}

function cartItemKey(item: UICartItem): string {
  if (item.uid) return item.uid
  if (!item.customization) return item.productId
  const c = item.customization
  const candleKey = (c.candles || [])
    .map((cd) => `${cd.candleOptionId}x${cd.quantity}`)
    .join("|")
  const optionKey = (c.options || []).map((op) => op.wholeCakeOptionId).join("|")
  const customOptKey = (c.customOptions || [])
    .map((o) => `${o.name}=${(o.values || []).join(",")}`)
    .join("|")
  return [
    item.productId,
    c.sizeId || "",
    candleKey,
    optionKey,
    c.messagePlate || "",
    customOptKey,
  ].join(":")
}

export function CartProvider({ children, storageKey = DEFAULT_STORAGE_KEY }: { children: ReactNode; storageKey?: string }) {
  const [items, setItems] = useState<UICartItem[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [deliveryAddress, setDeliveryAddressState] = useState<DeliveryAddress | null>(null)
  const [shippingFee, setShippingFeeState] = useState<number>(0)
  const [usedPoints, setUsedPointsState] = useState<number>(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed: PersistedCart = JSON.parse(raw)
        setItems(parsed.items || [])
        setStoreId(parsed.storeId ?? null)
        setDeliveryAddressState(parsed.deliveryAddress ?? null)
        setShippingFeeState(parsed.shippingFee ?? 0)
        setUsedPointsState(parsed.usedPoints ?? 0)
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!loaded) return
    const payload: PersistedCart = { items, storeId, deliveryAddress, shippingFee, usedPoints }
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [items, storeId, deliveryAddress, shippingFee, usedPoints, loaded, storageKey])

  const addItem = useCallback((item: UICartItem): AddItemResult => {
    const incomingCh = itemChannel(item)
    const currentCh = items.reduce<CartChannel>((acc, it) => acc ?? itemChannel(it), null)
    const sameStore = storeId == null || storeId === item.storeId
    if (sameStore && currentCh && incomingCh && currentCh !== incomingCh) {
      return {
        ok: false,
        error: "EC商品とテイクアウト商品は同じカートに追加できません",
      }
    }

    setItems((prev) => {
      if (storeId != null && storeId !== item.storeId) {
        setStoreId(item.storeId)
        return [item]
      }
      const key = cartItemKey(item)
      const existing = prev.find((p) => cartItemKey(p) === key)
      if (existing && !item.isCustomCake) {
        return prev.map((p) =>
          cartItemKey(p) === key ? { ...p, quantity: p.quantity + item.quantity } : p
        )
      }
      return [...prev, item]
    })
    if (storeId == null) setStoreId(item.storeId)
    return { ok: true }
  }, [storeId, items])

  const channel: CartChannel = items.reduce<CartChannel>((acc, it) => acc ?? itemChannel(it), null)

  const removeItem = useCallback((productId: string, customizationKey?: string) => {
    setItems((prev) =>
      prev.filter((p) => {
        if (p.productId !== productId) return true
        if (customizationKey && cartItemKey(p) !== customizationKey) return true
        return false
      })
    )
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number, customizationKey?: string) => {
    if (quantity <= 0) {
      removeItem(productId, customizationKey)
      return
    }
    setItems((prev) =>
      prev.map((p) => {
        if (p.productId !== productId) return p
        if (customizationKey && cartItemKey(p) !== customizationKey) return p
        return { ...p, quantity }
      })
    )
  }, [removeItem])

  const clear = useCallback(() => {
    setItems([])
    setStoreId(null)
    setDeliveryAddressState(null)
    setShippingFeeState(0)
    setUsedPointsState(0)
  }, [])

  const total = items.reduce((sum, item) => {
    let itemTotal = item.price * item.quantity
    if (item.customization) {
      const c = item.customization
      itemTotal += (c.sizePrice || 0) * item.quantity
      const candleTotal = (c.candles || []).reduce(
        (s, cd) => s + cd.price * cd.quantity,
        0
      )
      const optionTotal = (c.options || []).reduce((s, op) => s + op.price, 0)
      const customOptTotal = (c.customOptions || []).reduce(
        (s, o) => s + (o.additionalPrice || 0),
        0
      )
      itemTotal += (candleTotal + optionTotal + customOptTotal) * item.quantity
    }
    return sum + itemTotal
  }, 0)

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        storeId,
        channel,
        total,
        itemCount,
        deliveryAddress,
        shippingFee,
        usedPoints,
        addItem,
        removeItem,
        updateQuantity,
        clear,
        setDeliveryAddress: setDeliveryAddressState,
        setShippingFee: setShippingFeeState,
        setUsedPoints: setUsedPointsState,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
