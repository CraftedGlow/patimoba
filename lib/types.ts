import type { Database } from "./database.types"

// 新スキーマは text カラムベースなので enum は定義しない（代わりに union type）
export type OrderStatus = "new" | "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled"
export type PaymentMethod = "credit_card" | "bank_transfer" | "store" | "unpaid" | ""
export type ShippingType = "pickup" | "delivery" | "ec" | ""
export type StorageType = "room" | "refrigerator" | "freezer" | ""
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type AnniversaryType = "birthday" | "wedding" | "other"
export type StorePlan = "basic" | "standard" | "premium"

type StoreRow = Database["public"]["Tables"]["stores"]["Row"]
type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type OrderRow = Database["public"]["Tables"]["orders"]["Row"]
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
type CustomerStoreRelRow = Database["public"]["Tables"]["customer_store_relationships"]["Row"]
type CandleOptionRow = Database["public"]["Tables"]["candle_options"]["Row"]
type WholeCakeSizeRow = Database["public"]["Tables"]["whole_cake_sizes"]["Row"]
type WholeCakeOptionRow = Database["public"]["Tables"]["whole_cake_options"]["Row"]
type AnniversaryRow = Database["public"]["Tables"]["customer_anniversaries"]["Row"]
type ShippingAddressRow = Database["public"]["Tables"]["shipping_addresses"]["Row"]
type ShippingFeeRow = Database["public"]["Tables"]["shipping_fees"]["Row"]
type CouponRow = Database["public"]["Tables"]["coupons"]["Row"]

// UI型定義

export interface Product {
  id: string
  name: string
  price: number
  image: string
  category: string
  description: string
  isLimited: boolean
  limitedUntil?: string
  maxQuantity: number
  isPublished: boolean
}

export interface ManagedProduct {
  id: string
  name: string
  image: string
  description: string
  price: string
  priceNum: number
  acceptOrders: boolean
  todayAvailable: boolean
  dailyMax: number
  prepDays: number
  category: string
  maxPerOrder: number
  isPublished: boolean
  isEc: boolean
  ingredients?: string
  expirationDays?: number
  storageType?: StorageType | null
  shippingType?: ShippingType | null
}

export interface Order {
  id: string
  storeId: string
  customerId: string | null
  customerName: string
  lineName: string
  customerAvatar?: string
  phone: string
  orderDate: string
  visitTime: string
  pickupDate: string
  items: { name: string; quantity: number; totalAmount: number }[]
  total: number
  shippingFee: number
  shippingIncluded: boolean
  paymentMethod: PaymentMethod | null
  paymentStatus: string
  status: OrderStatus
  statusLabel: string
  isPrepared: boolean
  address?: string
  pickupTimeSlot?: string
  notes?: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  avatar?: string
  rank: "Bronze" | "Silver" | "Gold" | "Platinum"
  gender: "男性" | "女性" | "その他"
  phone: string
  email: string
  lastVisit: string
  birthday?: string
  allergies: string[]
  points: number
  totalPurchase: number
  storeId: string | null
}

export interface Store {
  id: string
  name: string
  address: string
  image: string
  email: string
  phone: string
  plan: StorePlan
  ec: boolean
  delivery: boolean
  openTime: string | null
  closeTime: string | null
  maxPerDay: number | null
  maxPerOrder: number | null
  logoUrl: string | null
  ownerName: string
  status: string
  notification: boolean
  joinDate: string | null
}

export interface CandleOption {
  id: string
  name: string
  price: number
  storeId: string
}

export interface WholeCakeSize {
  id: string
  label: string
  servings: string
  price: number
  wholeCakeProductId: string
}

export interface WholeCakeOption {
  id: string
  name: string
  price: number
  wholeCakeProductId: string
  image: string | null
  multipleAllowed: boolean
}

export interface WholeCakeProduct {
  id: string
  storeId: string
  name: string
  image: string
  sizes: WholeCakeSize[]
  options: WholeCakeOption[]
  candles: CandleOption[]
}

export interface UIAnniversary {
  id: string
  customerId: string
  storeId: string
  label: string
  month: number
  day: number
}

export interface UIDeliveryAddress {
  id: string
  customerId: string
  postalCode: string
  prefecture: string
  city: string
  address: string
  building: string
  isDefault: boolean
}

export interface UIShippingFee {
  id: string
  storeId: string | null
  minDistance: number
  maxDistance: number
  price: number
}

export interface UICoupon {
  id: string
  storeId: string
  name: string
  discountPrice: number
}

export interface UIOwnedCoupon {
  id: string
  customerId: string
  couponId: string
  quantity: number
  couponName?: string
  discountPrice?: number
}

export interface UICartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  storeId: string
  isCustomCake?: boolean
  customization?: {
    sizeId?: string
    sizeLabel?: string
    sizePrice?: number
    candleTypeId?: string
    candleName?: string
    candleCount?: number
    candlePrice?: number
    optionTypeId?: string
    optionName?: string
    optionPrice?: number
    messagePlate?: string
  }
}

// ラベル定義

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "新規",
  pending: "受付中",
  confirmed: "確認済み",
  preparing: "準備中",
  ready: "準備完了",
  completed: "受渡し済み",
  cancelled: "キャンセル",
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  credit_card: "決済済み",
  bank_transfer: "銀行振込",
  store: "店頭支払い",
  unpaid: "未払い",
  "": "未払い",
}

export function formatOrderStatus(status: string | null | undefined): string {
  if (!status) return "新規"
  return ORDER_STATUS_LABEL[status as OrderStatus] || String(status)
}

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "未払い"
  return PAYMENT_METHOD_LABEL[method] || "未払い"
}

// DB → UI 変換関数

export function toUIStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name || "",
    address: row.address || row.address_url || "",
    image: row.image || "",
    email: row.email || "",
    phone: row.phone || "",
    plan: (row.plan as StorePlan) || "standard",
    ec: row.ec ?? false,
    delivery: row.delivery ?? false,
    openTime: row.open_time,
    closeTime: row.close_time,
    maxPerDay: row.max_per_day,
    maxPerOrder: row.max_per_order,
    logoUrl: row.logo_url,
    ownerName: row.owner_name || "",
    status: row.status || "active",
    notification: row.notification ?? false,
    joinDate: row.join_date,
  }
}

export function toUIProduct(row: ProductRow, category?: string): Product {
  const now = new Date()
  const isLimited =
    row.order_start_date != null &&
    row.order_end_date != null &&
    new Date(row.order_end_date) > now
  const limitedUntil = row.order_end_date
    ? new Date(row.order_end_date).toLocaleDateString("ja-JP", { month: "long", day: "numeric" })
    : undefined

  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.price) || 0,
    image: row.image || "",
    category: category || row.category || "その他",
    description: row.description || "",
    isLimited,
    limitedUntil,
    maxQuantity: Number(row.max_per_order) || 5,
    isPublished: row.accept_orders ?? false,
  }
}

export function toUIManagedProduct(row: ProductRow, category?: string): ManagedProduct {
  const price = Number(row.price) || 0
  return {
    id: row.id,
    name: row.name || "",
    image: row.image || "",
    description: row.description || "",
    price: price > 0 ? `¥${price.toLocaleString()}` : "",
    priceNum: price,
    acceptOrders: row.accept_orders ?? false,
    todayAvailable: row.today_available ?? false,
    dailyMax: Number(row.max_per_day) || 30,
    prepDays: Number(row.prep_days) || 0,
    category: category || row.category || "その他",
    maxPerOrder: Number(row.max_per_order) || 10,
    isPublished: row.accept_orders ?? false,
    isEc: row.is_ec ?? false,
    ingredients: row.ingredients || undefined,
    expirationDays: row.expiration_days ?? undefined,
    storageType: (row.storage_type as StorageType) ?? null,
    shippingType: (row.shipping_type as ShippingType) ?? null,
  }
}

export function toUIOrder(row: any): Order {
  const createdDate = row.created_at ? new Date(row.created_at) : new Date()
  const pickupDateTime = row.pickup_date ? new Date(row.pickup_date) : null

  const formatDate = (d: Date) =>
    `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`

  const items: { name: string; quantity: number; totalAmount: number }[] = (row.order_items || []).map((it: any) => ({
    name: it.name || "不明",
    quantity: Number(it.quantity) || 1,
    totalAmount: Number(it.subtotal) || 0,
  }))

  const customer = row.customers || {}
  const status = (row.status as OrderStatus) || "new"

  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    customerName: row.customer_name || (customer.last_name_kn
      ? `${customer.last_name_kn}${customer.first_name_kn || ""}`
      : customer.line_name || ""),
    lineName: row.line_name || customer.line_name || "",
    customerAvatar: undefined,
    phone: row.phone || customer.phone || "",
    orderDate: formatDate(createdDate),
    visitTime: row.visit_time || "",
    pickupDate: pickupDateTime ? formatDate(pickupDateTime) : "",
    items,
    total: Number(row.total ?? row.subtotal) || 0,
    shippingFee: 0,
    shippingIncluded: row.shipping_included ?? false,
    paymentMethod: (row.payment_method as PaymentMethod) ?? null,
    paymentStatus: row.payment_status || formatPaymentMethod(row.payment_method),
    status,
    statusLabel: formatOrderStatus(status),
    isPrepared: row.is_prepared ?? false,
    address: row.shipping_address || undefined,
    pickupTimeSlot: row.pickup_time_slot || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  }
}

export function toUICustomer(row: CustomerRow & { customer_store_relationships?: CustomerStoreRelRow[] }): Customer {
  const rel = row.customer_store_relationships?.[0]
  const lastVisit = rel?.last_visit
    ? new Date(rel.last_visit).toLocaleDateString("ja-JP")
    : ""

  const birthday = row.birth_year && row.birth_month && row.birth_day
    ? `${row.birth_year}-${String(row.birth_month).padStart(2, "0")}-${String(row.birth_day).padStart(2, "0")}`
    : undefined

  return {
    id: row.id,
    name: row.line_name || `${row.last_name_kn || ""}${row.first_name_kn || ""}`,
    avatar: row.avatar || undefined,
    rank: (rel?.rank as Customer["rank"]) || "Bronze",
    gender: (row.gender as Customer["gender"]) || "その他",
    phone: row.phone || "",
    email: row.email || "",
    lastVisit,
    birthday,
    allergies: Array.isArray(row.allergies) ? row.allergies : [],
    points: Number(rel?.points_balance) || 0,
    totalPurchase: Number(rel?.total_spent) || 0,
    storeId: rel?.store_id ?? null,
  }
}

export function toUICandleOption(row: CandleOptionRow): CandleOption {
  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.price) || 0,
    storeId: row.store_id,
  }
}

export function toUIWholeCakeSize(row: WholeCakeSizeRow): WholeCakeSize {
  return {
    id: row.id,
    label: row.label || "",
    servings: row.servings || "",
    price: Number(row.price) || 0,
    wholeCakeProductId: row.whole_cake_product_id,
  }
}

export function toUIWholeCakeOption(row: WholeCakeOptionRow): WholeCakeOption {
  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.price) || 0,
    wholeCakeProductId: row.whole_cake_product_id,
    image: row.image,
    multipleAllowed: row.multiple_allowed ?? false,
  }
}

export function toUIAnniversary(row: AnniversaryRow): UIAnniversary {
  return {
    id: row.id,
    customerId: row.customer_id,
    storeId: row.store_id,
    label: row.label || "",
    month: Number(row.month) || 1,
    day: Number(row.day) || 1,
  }
}

export function toUIDeliveryAddress(row: ShippingAddressRow): UIDeliveryAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    postalCode: row.postal_code || "",
    prefecture: row.prefecture || "",
    city: row.city || "",
    address: row.address || "",
    building: row.building || "",
    isDefault: row.is_default ?? false,
  }
}

export function toUIShippingFee(row: ShippingFeeRow): UIShippingFee {
  return {
    id: row.id,
    storeId: row.store_id,
    minDistance: Number(row.min_distance) || 0,
    maxDistance: Number(row.max_distance) || 0,
    price: Number(row.price) || 0,
  }
}

export function toUICoupon(row: CouponRow): UICoupon {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name || "",
    discountPrice: Number(row.discount_price) || 0,
  }
}

export function toUIOwnedCoupon(row: any): UIOwnedCoupon {
  const coupon = row.coupons || null
  return {
    id: row.id,
    customerId: row.customer_id,
    couponId: row.coupon_id,
    quantity: Number(row.quantity) || 0,
    couponName: coupon?.name || undefined,
    discountPrice: coupon ? Number(coupon.discount_price) || 0 : undefined,
  }
}
