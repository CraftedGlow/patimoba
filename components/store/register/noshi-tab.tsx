"use client";

import { useState, useRef } from "react";
import { Loader2, Trash2, Check, ImagePlus, Plus, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNoshi, NoshiItem } from "@/hooks/use-noshi";
import { uploadNoshiImage } from "@/lib/upload-image";

export function NoshiTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? undefined;
  const { noshiList, loading, addNoshi, updateNoshi, deleteNoshi } = useNoshi(storeId);

  const NOSHI_PRESETS = ["御祝", "内祝い", "誕生日御祝", "出産御祝", "結婚御祝", "快気祝い", "その他"];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [namePreset, setNamePreset] = useState("");
  const [nameCustom, setNameCustom] = useState("");
  const [price, setPrice] = useState("");

  const name = namePreset === "その他" ? nameCustom : namePreset;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const clearForm = () => {
    setEditingId(null);
    setNamePreset("");
    setNameCustom("");
    setPrice("");
    setImageUrl(null);
    setError(null);
  };

  const startEdit = (item: NoshiItem) => {
    setEditingId(item.id);
    const isPreset = NOSHI_PRESETS.includes(item.name) && item.name !== "その他";
    setNamePreset(isPreset ? item.name : "その他");
    setNameCustom(isPreset ? "" : item.name);
    setPrice(String(item.price));
    setImageUrl(item.imageUrl);
    setError(null);
    setSaved(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;
    setUploading(true);
    const { url, error: uploadError } = await uploadNoshiImage(file, storeId);
    setUploading(false);
    if (uploadError) { setError(uploadError); return; }
    setImageUrl(url);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("用途を選択または入力してください"); return; }
    const priceNum = parseInt(price) || 0;
    setSaving(true);
    setError(null);
    let result;
    if (editingId) {
      result = await updateNoshi(editingId, { name: name.trim(), imageUrl, price: priceNum });
    } else {
      result = await addNoshi({ name: name.trim(), imageUrl, price: priceNum });
    }
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    clearForm();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    await deleteNoshi(id);
    setDeleting(false);
    setShowDeleteConfirm(null);
    if (editingId === id) clearForm();
  };

  return (
    <div className="flex gap-6">
      {/* List */}
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">のし一覧</h3>
          <button
            onClick={clearForm}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-bold"
          >
            <Plus size={14} />新規
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
        ) : noshiList.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">のしが登録されていません</p>
        ) : (
          <ul className="space-y-1">
            {noshiList.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => startEdit(item)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    editingId === item.id
                      ? "bg-amber-50 text-amber-800 font-bold"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">¥{item.price.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 max-w-lg">
        <h3 className="text-sm font-bold text-gray-700 mb-4">
          {editingId ? "のしを編集" : "のしを新規登録"}
        </h3>

        <div className="space-y-4">
          {/* Image */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">画像</label>
            <div
              onClick={() => imageInputRef.current?.click()}
              className="w-40 h-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-amber-300 transition-colors overflow-hidden bg-gray-50"
            >
              {uploading ? (
                <Loader2 className="animate-spin text-gray-400" size={24} />
              ) : imageUrl ? (
                <img src={imageUrl} alt="のし" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <ImagePlus size={24} />
                  <span className="text-xs">画像を追加</span>
                </div>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {imageUrl && (
              <button onClick={() => setImageUrl(null)} className="mt-1 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                <X size={12} />画像を削除
              </button>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-600">用途</label>
            <select
              value={namePreset}
              onChange={(e) => { setNamePreset(e.target.value); setNameCustom(""); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 bg-white"
            >
              <option value="">用途を選択</option>
              {NOSHI_PRESETS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {namePreset === "その他" && (
              <input
                type="text"
                value={nameCustom}
                onChange={(e) => setNameCustom(e.target.value)}
                placeholder="用途を入力"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">金額（円）</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min={0}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
              <span className="text-sm text-gray-500">円</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Pencil size={14} />}
              {saved ? "保存しました" : "保存"}
            </button>

            {editingId && (
              <>
                <button onClick={clearForm} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
                  キャンセル
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(editingId)}
                  className="ml-auto flex items-center gap-1 text-sm text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />削除
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-xs w-full mx-4">
            <p className="text-sm font-bold text-gray-800 mb-1">のしを削除しますか？</p>
            <p className="text-xs text-gray-500 mb-4">この操作は元に戻せません。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
