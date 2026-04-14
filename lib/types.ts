import type { Database } from "./database.types"

// 新スキーマは text カラムベースなので enum は定義しない（代わりに union type）
export type OrderStatus = "new" | "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled"
export type PaymentMethod = "credit_card" | "bank_transfer" | "store" | "unpaid" | ""
export type ShippingType = "pickup" | "delivery" | "ec" | ""
export type StorageType = "room" | "refrigerator" | "freezer" | ""
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type AnniversaryType = "birthday" | "wedding" | "other"

type StoreRow = Database["public"]["Tables"]["stores"]["Row"]
type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type OrderRow = Database["public"]["Tables"]["orders"]["Row"]
type UserRow = Database["public"]["Tables"]["users"]["Row"]
type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"]

// UI型定義

export interface Product {
  id: string
  name: string
  price: number
  image: string
  category: string
  description: string
  isActive: boolean
  maxQuantity: number
}

export interface ProductCustomOptionValue {
  label: string
  additional_price: number
}

export interface ProductCustomOption {
  name: string
  type: "single" | "multiple" | "text"
  required: boolean
  values: ProductCustomOptionValue[]
}

export interface ManagedProduct {
  id: string
  name: string
  image: string
  description: string
  price: string
  priceNum: number
  isActive: boolean
  sameDayOrderAllowed: boolean
  minOrderLeadMinutes: number
  category: string
  isPreorderRequired: boolean
  taxType: string
  displayOrder: number
  isTakeout: boolean
  isEc: boolean
  dailyMaxQuantity: number | null
  preparationDays: number
  customOptions: ProductCustomOption[]
}

export type FulfillmentStatus = "pending" | "fulfilled"

export interface Order {
  id: string
  orderNo: string
  storeId: string
  customerId: string | null
  customerName: string
  lineName: string
  customerAvatar?: string
  phone: string
  orderDate: string
  pickupDate: string
  pickupTime: string
  items: { name: string; quantity: number; totalAmount: number }[]
  subtotal: number
  discountAmount: number
  totalAmount: number
  paymentStatus: string
  orderStatus: OrderStatus
  statusLabel: string
  orderType: string
  fulfillmentStatus: FulfillmentStatus
  fulfilledAt: string | null
  fulfilledBy: string | null
  notes?: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  lineName: string
  userType: string
  status: string
}

export type StorePlan = "free" | "premium"

export interface Store {
  id: string
  name: string
  slug: string
  description: string
  address: string
  building: string
  image: string
  email: string
  phone: string
  postalCode: string
  isActive: boolean
  logoUrl: string | null
  lineOfficialAccountId: string | null
  plan: StorePlan
}

export interface WholeCakeSize {
  id: string
  name: string
  price: number
  productId: string
  isActive: boolean
  displayOrder: number
}

export interface WholeCakeProduct {
  id: string
  storeId: string
  name: string
  image: string
  sizes: WholeCakeSize[]
}

export interface CartCandleEntry {
  candleOptionId: string
  name: string
  price: number
  quantity: number
}

export interface CartCakeOptionEntry {
  wholeCakeOptionId: string
  name: string
  price: number
}

export interface UICartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  storeId: string
  isCustomCake?: boolean
  isEc?: boolean
  isTakeout?: boolean
  uid?: string
  customization?: {
    sizeId?: string
    sizeLabel?: string
    sizePrice?: number
    candles?: CartCandleEntry[]
    options?: CartCakeOptionEntry[]
    messagePlate?: string
    allergyNote?: string
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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: "決済済み",
  unpaid: "未払い",
  refunded: "返金済み",
}

export function formatOrderStatus(status: string | null | undefined): string {
  if (!status) return "新規"
  return ORDER_STATUS_LABEL[status as OrderStatus] || String(status)
}

export function formatPaymentStatus(status: string | null | undefined): string {
  if (!status) return "未払い"
  return PAYMENT_STATUS_LABEL[status] || "未払い"
}

// DB → UI 変換関数

export function toUIStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name || "",
    slug: row.slug || "",
    description: row.description || "",
    address: row.address || "",
    building: row.building || "",
    image: row.image || "",
    email: row.email || "",
    phone: row.phone || "",
    postalCode: row.postal_code || "",
    isActive: row.is_active ?? true,
    logoUrl: row.logo_url,
    lineOfficialAccountId: row.line_official_account_id,
    plan: (row.plan === "premium" ? "premium" : "free") as StorePlan,
  }
}

export function toUIProduct(row: ProductRow, category?: string): Product {
  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.base_price) || 0,
    image: row.image || "",
    category: category || row.category_name || "その他",
    description: row.description || "",
    isActive: row.is_active ?? true,
    maxQuantity: 10,
  }
}

export function toUIManagedProduct(row: ProductRow, category?: string): ManagedProduct {
  const price = Number(row.base_price) || 0
  return {
    id: row.id,
    name: row.name || "",
    image: row.image || "",
    description: row.description || "",
    price: price > 0 ? `¥${price.toLocaleString()}` : "",
    priceNum: price,
    isActive: row.is_active ?? true,
    sameDayOrderAllowed: row.same_day_order_allowed ?? false,
    minOrderLeadMinutes: Number(row.min_order_lead_minutes) || 0,
    category: category || row.category_name || "その他",
    isPreorderRequired: row.is_preorder_required ?? false,
    taxType: row.tax_type || "included",
    displayOrder: Number(row.display_order) || 0,
    isTakeout: (row as any).is_takeout ?? true,
    isEc: (row as any).is_ec ?? false,
    dailyMaxQuantity: (row as any).daily_max_quantity ?? null,
    preparationDays: Number((row as any).preparation_days) || 0,
    customOptions: normalizeCustomOptions((row as any).custom_options),
  }
}

export function normalizeCustomOptions(raw: unknown): ProductCustomOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((o): o is Record<string, any> => o !== null && typeof o === "object")
    .map((o) => ({
      name: String(o.name ?? ""),
      type: (o.type === "multiple" || o.type === "text") ? o.type : "single",
      required: Boolean(o.required),
      values: Array.isArray(o.values)
        ? o.values
            .filter((v: any) => v && typeof v === "object")
            .map((v: any) => ({
              label: String(v.label ?? ""),
              additional_price: Number(v.additional_price) || 0,
            }))
        : [],
    }))
}

export function toUIOrder(row: any): Order {
  const createdDate = row.created_at ? new Date(row.created_at) : new Date()
  const pickupDate = row.pickup_date || ""
  const pickupTime = row.pickup_time || ""

  const formatDate = (d: Date) =>
    `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`

  const items: { name: string; quantity: number; totalAmount: number }[] = (row.order_items || []).map((it: any) => ({
    name: it.product_name_snapshot || "不明",
    quantity: Number(it.quantity) || 1,
    totalAmount: Number(it.subtotal) || 0,
  }))

  const user = row.users || {}
  const orderStatus = (row.order_status as OrderStatus) || "new"

  return {
    id: row.id,
    orderNo: row.order_no || "",
    storeId: row.store_id,
    customerId: row.customer_id,
    customerName: user.name || "",
    lineName: user.line_name || "",
    customerAvatar: undefined,
    phone: user.phone || "",
    orderDate: formatDate(createdDate),
    pickupDate,
    pickupTime,
    items,
    subtotal: Number(row.subtotal) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    paymentStatus: formatPaymentStatus(row.payment_status),
    orderStatus,
    statusLabel: formatOrderStatus(orderStatus),
    orderType: row.order_type || "pickup",
    fulfillmentStatus: (row.fulfillment_status === "fulfilled" ? "fulfilled" : "pending") as FulfillmentStatus,
    fulfilledAt: row.fulfilled_at || null,
    fulfilledBy: row.fulfilled_by || null,
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  }
}

export function toUICustomer(row: UserRow): Customer {
  return {
    id: row.id,
    name: row.name || row.line_name || "",
    email: row.email || "",
    phone: row.phone || "",
    lineName: row.line_name || "",
    userType: row.user_type || "customer",
    status: row.status || "active",
  }
}

export function toUIWholeCakeSize(row: ProductVariantRow): WholeCakeSize {
  return {
    id: row.id,
    name: row.name || "",
    price: Number(row.price) || 0,
    productId: row.product_id,
    isActive: row.is_active ?? true,
    displayOrder: Number(row.display_order) || 0,
  }
}
