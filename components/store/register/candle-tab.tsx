"use client";

import { useState, useRef } from "react";
import { Trash2, Check, ImagePlus, Pencil, X } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useAuth } from "@/lib/auth-context";
import { useCandles, CandleItem } from "@/hooks/use-candles";
import { uploadCandleImage } from "@/lib/upload-image";

export function CandleTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? undefined;
  const { candleList, loading, addCandle, updateCandle, deleteCandle } = useCandles(storeId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"number" | "normal">("normal");
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
    setName("");
    setPrice("");
    setType("normal");
    setImageUrl(null);
    setError(null);
  };

  const startEdit = (item: CandleItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(String(item.price));
    setType(item.type);
    setImageUrl(item.imageUrl);
    setError(null);
    setSaved(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;
    setUploading(true);
    const { url, error: uploadError } = await uploadCandleImage(file, storeId);
    setUploading(false);
    if (uploadError) { setError(uploadError); return; }
    setImageUrl(url);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("種類名を入力してください"); return; }
    const priceNum = parseInt(price) || 0;
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), imageUrl, price: priceNum, type };
    const result = editingId
      ? await updateCandle(editingId, payload)
      : await addCandle(payload);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    clearForm();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    await deleteCandle(id);
    setDeleting(false);
    setShowDeleteConfirm(null);
    if (editingId === id) clearForm();
  };

  return (
    <>
      <div className="flex flex-col gap-6 [@media(min-width:650px)]:flex-row">

        {/* フォーム - LEFT */}
        <div className="flex-1 min-w-0 max-w-lg">
          <h3 className="text-sm font-bold text-gray-700 mb-4">
            {editingId ? "ろうそくを編集" : "ろうそくを新規登録"}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            ホールケーキ等に付けられるろうそくです。商品ごとに使用する種類を選べます。
          </p>

          <div className="space-y-4">
            {/* Image */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">画像</label>
              <div
                onClick={() => imageInputRef.current?.click()}
                className="w-full max-w-[160px] h-[130px] sm:h-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-amber-300 transition-colors overflow-hidden bg-gray-50"
              >
                {uploading ? (
                  <LineSpinner size={24} />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="ろうそく" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-600">
                    <ImagePlus size={24} />
                    <span className="text-xs">画像を追加</span>
                  </div>
                )}
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              {imageUrl && (
                <button onClick={() => setImageUrl(null)} className="mt-1 text-xs text-gray-600 hover:text-red-500 flex items-center gap-1">
                  <X size={12} />画像を削除
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">種類名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：ナンバーキャンドル、ノーマルキャンドル など"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">タイプ</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="candle-type"
                    checked={type === "normal"}
                    onChange={() => setType("normal")}
                    className="accent-amber-500"
                  />
                  ノーマル型
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="candle-type"
                    checked={type === "number"}
                    onChange={() => setType("number")}
                    className="accent-amber-500"
                  />
                  ナンバー型
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">ナンバー型に設定すると、顧客画面で数字（0〜9）を指定できます</p>
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
                {saving ? <LineSpinner size={20} /> : saved ? <Check size={14} /> : <Pencil size={14} />}
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

        {/* 一覧 - RIGHT */}
        <div className="w-full [@media(min-width:650px)]:w-80 [@media(min-width:650px)]:flex-shrink-0">
          <h3 className="text-sm font-bold text-gray-700 mb-3">ろうそく一覧</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <LineSpinner size={20} />
            </div>
          ) : candleList.length === 0 ? (
            <p className="text-xs text-gray-600 py-4 text-center">ろうそくが登録されていません</p>
          ) : (
            <ul className="space-y-1.5 overflow-y-auto max-h-[480px] pr-1">
              {candleList.map((item) => {
                const isMaster = item.isMasterItem ?? false
                return (
                <li key={item.id}>
                  <div
                    className={`w-full px-3 py-2.5 rounded-lg text-sm flex items-start gap-2 border transition-colors ${
                      isMaster
                        ? "bg-blue-50/40 border-blue-100"
                        : editingId === item.id
                        ? "bg-amber-50 border-amber-200"
                        : "bg-gray-50 border-transparent"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded flex-shrink-0 mt-0.5 overflow-hidden flex items-center justify-center ${item.imageUrl ? "bg-gray-100" : ""}`}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <img src="/candle-icon.png" alt="" className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-700 truncate">{item.name}</p>
                        {isMaster && (
                          <span className="text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded shrink-0">共有</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                          {item.type === "number" ? "ナンバー型" : "ノーマル型"}
                        </span>
                        <span className="text-xs text-gray-600">¥{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(item)}
                      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                        editingId === item.id
                          ? "bg-amber-400 text-white"
                          : "bg-white border border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600"
                      }`}
                    >
                      <Pencil size={11} />
                      編集
                    </button>
                  </div>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-xs w-full mx-4">
            <p className="text-sm font-bold text-gray-800 mb-1">ろうそくを削除しますか？</p>
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
                {deleting ? <LineSpinner size={20} /> : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
