"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, Loader2, ImagePlus, Pencil, Trash2, Check, ChevronDown, ChevronUp, Cherry, LayoutGrid, Sparkles, Droplets, Tag, type LucideIcon } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useDecorations } from "@/hooks/use-decorations"
import { useDecorationGroups } from "@/hooks/use-decoration-groups"
import { uploadDecorationImage, deleteProductImage } from "@/lib/upload-image"
import type { DecorationItem, DecorationGroupWithItems } from "@/lib/types"

const CATEGORY_LABELS: Record<string, string> = {
  fruit: "フルーツ",
  plate: "プレート",
  topping: "トッピング",
  cream: "クリーム",
  other: "その他",
}
const CATEGORIES = Object.keys(CATEGORY_LABELS)
const CATEGORY_ICON: Record<string, LucideIcon> = {
  fruit: Cherry,
  plate: LayoutGrid,
  topping: Sparkles,
  cream: Droplets,
  other: Tag,
}

function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICON[category] ?? Tag
  return <Icon size={size} className="text-gray-400" />
}

// ────────────────────────────────────────────
// Decoration Form Panel
// ────────────────────────────────────────────
interface DecorationFormProps {
  storeId: string
  initial?: DecorationItem
  onSave: (data: {
    name: string; description: string; imageUrl: string | null; category: string
    price: number; isSeasonal: boolean; seasonStart: string | null; seasonEnd: string | null
    preparationDays: number | null
  }) => Promise<{ error: string | null }>
  onClose: () => void
}

function DecorationForm({ storeId, initial, onSave, onClose }: DecorationFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [category, setCategory] = useState(initial?.category ?? "other")
  const [price, setPrice] = useState(String(initial?.price ?? 0))
  const [description, setDescription] = useState(initial?.description ?? "")
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [isSeasonal, setIsSeasonal] = useState(initial?.isSeasonal ?? false)
  const [seasonStart, setSeasonStart] = useState(initial?.seasonStart ?? "")
  const [seasonEnd, setSeasonEnd] = useState(initial?.seasonEnd ?? "")
  const [preparationDays, setPreparationDays] = useState<number | null>(initial?.preparationDays ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    const { url, error: err } = await uploadDecorationImage(file, storeId)
    setUploading(false)
    if (err) { setError(`画像アップロード失敗: ${err}`); return }
    setImageUrl(url)
  }

  const handleRemoveImage = async () => {
    if (imageUrl) await deleteProductImage(imageUrl)
    setImageUrl(null)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError("名前を入力してください"); return }
    setSaving(true)
    setError(null)
    const { error: err } = await onSave({
      name: name.trim(),
      description: description.trim(),
      imageUrl,
      category,
      price: parseInt(price, 10) || 0,
      isSeasonal,
      seasonStart: isSeasonal && seasonStart ? seasonStart : null,
      seasonEnd: isSeasonal && seasonEnd ? seasonEnd : null,
      preparationDays,
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
          placeholder="例: いちごデコレーション"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
        />
      </div>

      {/* カテゴリ */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
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
            className="w-28 h-28 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-amber-400 hover:bg-amber-50 transition-colors"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
            <span className="text-xs">画像を追加</span>
          </motion.button>
        )}
      </div>

      {/* 価格 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">追加料金</label>
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
          <span className="text-xs text-gray-400">（0 = 無料）</span>
        </div>
      </div>

      {/* 説明 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="例: 新鮮な苺をたっぷり使用"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* 季節限定 */}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isSeasonal} onChange={(e) => setIsSeasonal(e.target.checked)} className="w-4 h-4" />
          季節限定
        </label>
        <AnimatePresence>
          {isSeasonal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2 pl-6"
            >
              <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-xs text-gray-400">〜</span>
              <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 準備日数 */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">準備日数（任意）</label>
        <select
          value={preparationDays ?? ""}
          onChange={(e) => setPreparationDays(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300"
        >
          <option value="">制限なし</option>
          {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((d) => (
            <option key={d} value={d}>{d}日前まで</option>
          ))}
        </select>
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
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          保存する
        </motion.button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Group Form
// ────────────────────────────────────────────
interface GroupFormProps {
  initial?: DecorationGroupWithItems
  onSave: (data: { name: string; description: string; selectionType: "single" | "multiple"; maxSelections: number | null; required: boolean; preparationDays: number | null }) => Promise<{ error: string | null }>
  onClose: () => void
}

function GroupForm({ initial, onSave, onClose }: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [selectionType, setSelectionType] = useState<"single" | "multiple">(initial?.selectionType ?? "single")
  const [maxSelections, setMaxSelections] = useState(String(initial?.maxSelections ?? ""))
  const [required, setRequired] = useState(initial?.required ?? false)
  const [preparationDays, setPreparationDays] = useState(String(initial?.preparationDays ?? ""))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError("グループ名を入力してください"); return }
    setSaving(true)
    setError(null)
    const { error: err } = await onSave({
      name: name.trim(),
      description: description.trim(),
      selectionType,
      maxSelections: selectionType === "multiple" && maxSelections ? parseInt(maxSelections, 10) || null : null,
      required,
      preparationDays: preparationDays ? parseInt(preparationDays, 10) || null : null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">グループ名</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="例: プレート選択"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">説明（任意）</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 名前入りプレートを選べます"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-2">選択形式</label>
        <div className="flex gap-4">
          {(["single", "multiple"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="selectionType" checked={selectionType === t}
                onChange={() => setSelectionType(t)} className="accent-amber-500 w-4 h-4" />
              {t === "single" ? "単一選択" : "複数選択"}
            </label>
          ))}
        </div>
        <AnimatePresence>
          {selectionType === "multiple" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-2">
              <input type="number" value={maxSelections} onChange={(e) => setMaxSelections(e.target.value)} min={1}
                placeholder="上限なし"
                className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              <span className="text-xs text-gray-400">個まで（空欄 = 上限なし）</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="w-4 h-4" />
        必須選択にする
      </label>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">準備日数（任意）</label>
        <div className="flex items-center gap-2">
          <input type="number" value={preparationDays} onChange={(e) => setPreparationDays(e.target.value)} min={0}
            placeholder="例: 3"
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-300" />
          <span className="text-xs text-gray-400">日前まで（空欄 = 制限なし）</span>
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2 pt-2">
        <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          キャンセル
        </motion.button>
        <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleSubmit} disabled={saving}
          className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          保存する
        </motion.button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────
export default function DecorationsPage() {
  const { user } = useAuth()
  const storeId = user?.storeId ?? ""

  const { decorations, loading: decoLoading, createDecoration, updateDecoration, deleteDecoration } = useDecorations(storeId)
  const { groups, loading: groupLoading, createGroup, updateGroup, deleteGroup, addItemToGroup, removeItemFromGroup } = useDecorationGroups(storeId)

  const [tab, setTab] = useState<"decorations" | "groups">("decorations")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Decoration panel state
  const [decoPanel, setDecoPanel] = useState<"closed" | "new" | string>("closed")
  const editingDeco = typeof decoPanel === "string" && decoPanel !== "closed" && decoPanel !== "new"
    ? decorations.find((d) => d.id === decoPanel)
    : undefined

  // Group panel state
  const [groupPanel, setGroupPanel] = useState<"closed" | "new" | string>("closed")
  const editingGroup = typeof groupPanel === "string" && groupPanel !== "closed" && groupPanel !== "new"
    ? groups.find((g) => g.id === groupPanel)
    : undefined

  // Add-decoration-to-group modal
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null)
  const addingGroup = groups.find((g) => g.id === addToGroupId)

  // Expand state for groups
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => {
    setExpandedGroupIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // Delete confirmations
  const [deleteDecoId, setDeleteDecoId] = useState<string | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)

  const filteredDecos = categoryFilter === "all" ? decorations : decorations.filter((d) => d.category === categoryFilter)

  if (decoLoading || groupLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold mb-6">デコレーション管理</h1>

      {/* Tab */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["decorations", "groups"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              tab === t ? "border-amber-400 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "decorations" ? "デコレーション一覧" : "グループ管理"}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Decorations ─── */}
      {tab === "decorations" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
              {["all", ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    categoryFilter === c
                      ? "bg-amber-400 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c === "all" ? "すべて" : (
                    <span className="inline-flex items-center gap-1">
                      <CategoryIcon category={c} size={12} />
                      {CATEGORY_LABELS[c]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setDecoPanel("new")}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 新規登録
            </motion.button>
          </div>

          {filteredDecos.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">登録されたデコレーションがありません</p>
          ) : (
            <div className="space-y-2">
              {filteredDecos.map((deco) => (
                <div key={deco.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center text-2xl">
                    {deco.imageUrl ? (
                      <img src={deco.imageUrl} alt={deco.name} className="w-full h-full object-cover" />
                    ) : (
                      <CategoryIcon category={deco.category} size={22} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{deco.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                        {CATEGORY_LABELS[deco.category] ?? deco.category}
                      </span>
                      {deco.isSeasonal && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shrink-0">季節限定</span>
                      )}
                    </div>
                    {deco.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{deco.description}</p>
                    )}
                  </div>
                  <div className="text-sm font-bold text-amber-600 shrink-0">
                    {deco.price === 0 ? "無料" : `+¥${deco.price.toLocaleString()}`}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setDecoPanel(deco.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteDecoId(deco.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Groups ─── */}
      {tab === "groups" && (
        <div>
          <div className="flex justify-end mb-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setGroupPanel("new")}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 新規グループ
            </motion.button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">グループがありません</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const expanded = expandedGroupIds.has(group.id)
                return (
                  <div key={group.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => toggleExpand(group.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{group.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {group.selectionType === "single" ? "単一選択" : `複数選択${group.maxSelections ? `（最大${group.maxSelections}個）` : ""}`}
                          {group.required ? " / 必須" : " / 任意"}
                          {" · "}デコレーション {group.items.length}件
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setGroupPanel(group.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteGroupId(group.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-gray-100"
                        >
                          <div className="px-4 py-3 space-y-2">
                            {group.items.length === 0 ? (
                              <p className="text-xs text-gray-400">まだデコレーションが追加されていません</p>
                            ) : (
                              group.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center text-sm">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <CategoryIcon category={item.category} size={14} />
                                    )}
                                  </div>
                                  <span className="text-sm flex-1">{item.name}</span>
                                  <span className="text-xs text-amber-600 font-medium">
                                    {item.price === 0 ? "無料" : `+¥${item.price.toLocaleString()}`}
                                  </span>
                                  <button type="button"
                                    onClick={() => removeItemFromGroup(group.id, item.id)}
                                    className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setAddToGroupId(group.id)}
                              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-bold mt-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> デコレーションを追加
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Decoration Form Slide Panel ─── */}
      <AnimatePresence>
        {decoPanel !== "closed" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setDecoPanel("closed")} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold">{editingDeco ? "デコレーション編集" : "デコレーション登録"}</h2>
                  <button type="button" onClick={() => setDecoPanel("closed")} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <DecorationForm
                  storeId={storeId}
                  initial={editingDeco}
                  onSave={async (data) => {
                    if (editingDeco) {
                      return updateDecoration(editingDeco.id, {
                        name: data.name, description: data.description || null,
                        imageUrl: data.imageUrl, category: data.category, price: data.price,
                        isSeasonal: data.isSeasonal,
                        seasonStart: data.seasonStart, seasonEnd: data.seasonEnd,
                        preparationDays: data.preparationDays,
                      })
                    } else {
                      return createDecoration(storeId, {
                        name: data.name, description: data.description || undefined,
                        imageUrl: data.imageUrl ?? undefined, category: data.category,
                        price: data.price, isSeasonal: data.isSeasonal,
                        seasonStart: data.seasonStart, seasonEnd: data.seasonEnd,
                        preparationDays: data.preparationDays,
                      })
                    }
                  }}
                  onClose={() => setDecoPanel("closed")}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Group Form Modal ─── */}
      <AnimatePresence>
        {groupPanel !== "closed" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setGroupPanel("closed")} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold">{editingGroup ? "グループ編集" : "グループ作成"}</h2>
                <button type="button" onClick={() => setGroupPanel("closed")} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <GroupForm
                initial={editingGroup}
                onSave={async (data) => {
                  if (editingGroup) return updateGroup(editingGroup.id, data)
                  return (await createGroup(storeId, data)).error !== null
                    ? { error: "作成に失敗しました" }
                    : { error: null }
                }}
                onClose={() => setGroupPanel("closed")}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Add Decoration to Group Modal ─── */}
      <AnimatePresence>
        {addToGroupId && addingGroup && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setAddToGroupId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">「{addingGroup.name}」にデコレーションを追加</h2>
                <button type="button" onClick={() => setAddToGroupId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {decorations.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">先にデコレーションを登録してください</p>
                )}
                {decorations.map((deco) => {
                  const alreadyIn = addingGroup.items.some((i) => i.id === deco.id)
                  return (
                    <div key={deco.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center text-lg">
                        {deco.imageUrl ? (
                          <img src={deco.imageUrl} alt={deco.name} className="w-full h-full object-cover" />
                        ) : <CategoryIcon category={deco.category} size={18} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{deco.name}</p>
                        <p className="text-xs text-gray-400">{deco.price === 0 ? "無料" : `+¥${deco.price.toLocaleString()}`}</p>
                      </div>
                      {alreadyIn ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-bold">
                          <Check className="w-3.5 h-3.5" /> 追加済
                        </span>
                      ) : (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addItemToGroup(addingGroup.id, deco.id)}
                          className="text-xs bg-amber-400 hover:bg-amber-500 text-white font-bold px-3 py-1 rounded-full transition-colors"
                        >
                          追加
                        </motion.button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="pt-4">
                <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setAddToGroupId(null)}
                  className="w-full border border-gray-300 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  閉じる
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Delete Decoration Confirm ─── */}
      <AnimatePresence>
        {deleteDecoId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setDeleteDecoId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-bold text-center mb-2">このデコレーションを削除しますか？</p>
              <p className="text-xs text-gray-500 text-center mb-6">グループから自動的に削除されます</p>
              <div className="flex gap-3">
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { deleteDecoration(deleteDecoId); setDeleteDecoId(null) }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm transition-colors">
                  削除する
                </motion.button>
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteDecoId(null)}
                  className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-full text-sm hover:bg-gray-50 transition-colors">
                  キャンセル
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Delete Group Confirm ─── */}
      <AnimatePresence>
        {deleteGroupId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setDeleteGroupId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-bold text-center mb-2">このグループを削除しますか？</p>
              <p className="text-xs text-gray-500 text-center mb-6">商品との紐付けも解除されます</p>
              <div className="flex gap-3">
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { deleteGroup(deleteGroupId); setDeleteGroupId(null) }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm transition-colors">
                  削除する
                </motion.button>
                <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteGroupId(null)}
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
