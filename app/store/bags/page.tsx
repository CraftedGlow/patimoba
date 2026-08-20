"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, ImagePlus, Pencil, Trash2, ShoppingBag } from "lucide-react"
import { LineSpinner } from "@/components/ui/line-spinner"
import { useAuth } from "@/lib/auth-context"
import { useBags, type BagItem } from "@/hooks/use-bags"
import { useProductRegistrations } from "@/hooks/use-product-registrations"
import { uploadBagImage, deleteProductImage } from "@/lib/upload-image"

// ────────────────────────────────────────────
// Bag Form Panel
// ────────────────────────────────────────────
interface BagFormProps {
  storeId: string
  initial?: BagItem
  products: { id: string; name: string }[]
  onSave: (data: {
    name: string; imageUrl: string | null; price: number; capacity: number; productIds: string[]
  }) => Promise<{ error: string | null }>
  onClose: () => void
}

function BagForm({ storeId, initial, products, onSave, onClose }: BagFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [price, setPrice] = useState(String(initial?.price ?? 0))
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 1))
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [productIds, setProductIds] = useState<string[]>(initial?.productIds ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    const { url, error: err } = await uploadBagImage(file, storeId)
    setUploading(false)
    if (err) { setError(`画像アップロード失敗: ${err}`); return }
    setImageUrl(url)
  }

  const handleRemoveImage = async () => {
    if (imageUrl) await deleteProductImage(imageUrl)
    setImageUrl(null)
  }

  const toggleProduct = (id: string) => {
    setProductIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError("名前を入力してください"); return }
    setSaving(true)
    setError(null)
    const { error: err } = await onSave({
      name: name.trim(),
      imageUrl,
      price: parseInt(price, 10) || 0,
      capacity: Math.max(1, parseInt(capacity, 10) || 1),
      productIds,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* 名前 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">名前</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Mサイズ袋"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
        />
      </div>

      {/* 画像 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">画像（推奨: 正方形）</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
        {imageUrl ? (
          <div className="relative w-28 h-28">
            <img src={imageUrl} alt="" className="w-28 h-28 rounded-lg object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-28 h-28 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-600 hover:border-amber-400 hover:bg-amber-50 transition-colors"
          >
            {uploading ? <LineSpinner size={20} /> : <ImagePlus className="w-6 h-6" />}
            <span className="text-xs">画像を追加</span>
          </motion.button>
        )}
      </div>

      {/* 価格 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">金額</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">¥</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={0}
            placeholder="0"
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
          />
          <span className="text-xs text-gray-600">（0 = 無料）</span>
        </div>
      </div>

      {/* 容量 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">容量（何個まで入るか）</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min={1}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
          />
          <span className="text-xs text-gray-600">個まで</span>
        </div>
      </div>

      {/* 対応商品 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">対応商品</label>
        {products.length === 0 ? (
          <p className="text-xs text-gray-500">テイクアウト商品が登録されていません</p>
        ) : (
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={productIds.includes(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  className="w-4 h-4"
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LineSpinner size={16} />}
          保存する
        </motion.button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────
export default function BagsPage() {
  const { user } = useAuth()
  const storeId = user?.storeId ?? ""

  const { bags, loading: bagsLoading, addBag, updateBag, deleteBag } = useBags(storeId)
  const { products, loading: productsLoading } = useProductRegistrations({ storeId })
  const takeoutProducts = products.filter((p) => p.is_takeout).map((p) => ({ id: p.id, name: p.name }))
  const productNameMap = Object.fromEntries(takeoutProducts.map((p) => [p.id, p.name]))

  const [panel, setPanel] = useState<"closed" | "new" | string>("closed")
  const editingBag = typeof panel === "string" && panel !== "closed" && panel !== "new"
    ? bags.find((b) => b.id === panel)
    : undefined

  const [deleteBagId, setDeleteBagId] = useState<string | null>(null)

  if (bagsLoading || productsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <LineSpinner size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">袋管理</h1>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setPanel("new")}
          className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> 新規登録
        </motion.button>
      </div>

      {bags.length === 0 ? (
        <p className="text-sm text-gray-600 py-10 text-center">登録された袋がありません</p>
      ) : (
        <div className="space-y-2">
          {bags.map((bag) => {
            const isMaster = bag.isMasterItem ?? false
            return (
            <div key={bag.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isMaster ? "border-blue-100 bg-blue-50/40" : bag.isActive ? "border-gray-200 bg-white hover:bg-gray-50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                {bag.imageUrl ? (
                  <img src={bag.imageUrl} alt={bag.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-bold">{bag.name}</p>
                  {isMaster && (
                    <span className="text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded shrink-0">共有</span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                    {bag.capacity}個まで
                  </span>
                  {!bag.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">非表示</span>
                  )}
                </div>
                <p className="text-sm font-bold text-amber-600 mt-1">
                  {bag.price === 0 ? "無料" : `+¥${bag.price.toLocaleString()}`}
                </p>
                {bag.productIds.length > 0 ? (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    対応商品: {bag.productIds.map((id) => productNameMap[id] ?? "").filter(Boolean).join("、")}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">対応商品が未設定です</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => updateBag(bag.id, {
                    name: bag.name, imageUrl: bag.imageUrl, price: bag.price,
                    capacity: bag.capacity, productIds: bag.productIds, isActive: !bag.isActive,
                  })}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${bag.isActive ? "bg-amber-400" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${bag.isActive ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <button type="button" onClick={() => setPanel(bag.id)}
                  className="p-2 rounded-lg text-gray-600 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setDeleteBagId(bag.id)}
                  className="p-2 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* ─── Bag Form Slide Panel ─── */}
      <AnimatePresence>
        {panel !== "closed" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setPanel("closed")} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold">{editingBag ? "袋の編集" : "袋の登録"}</h2>
                  <button type="button" onClick={() => setPanel("closed")} className="text-gray-600 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <BagForm
                  storeId={storeId}
                  initial={editingBag}
                  products={takeoutProducts}
                  onSave={async (data) => {
                    if (editingBag) {
                      return updateBag(editingBag.id, { ...data, isActive: editingBag.isActive })
                    }
                    return addBag(data)
                  }}
                  onClose={() => setPanel("closed")}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirm ─── */}
      <AnimatePresence>
        {deleteBagId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setDeleteBagId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-bold text-center mb-6">この袋を削除しますか？</p>
              <div className="flex gap-3">
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { deleteBag(deleteBagId); setDeleteBagId(null) }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm transition-colors">
                  削除する
                </motion.button>
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteBagId(null)}
                  className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-full text-sm hover:bg-gray-50 transition-colors">
                  キャンセル
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
