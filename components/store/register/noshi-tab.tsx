"use client";

import { useState, useRef } from "react";
import { Trash2, Check, ImagePlus, Pencil, X } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { useAuth } from "@/lib/auth-context";
import { useNoshi, NoshiItem } from "@/hooks/use-noshi";
import { uploadNoshiImage } from "@/lib/upload-image";

const NOSHI_PRESETS = ["御祝", "内祝", "御礼", "御中元", "御歳暮", "結婚祝", "出産祝", "快気祝", "御供", "志"];

export function NoshiTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? undefined;
  const { noshiList, loading, addNoshi, updateNoshi, deleteNoshi } = useNoshi(storeId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [designName, setDesignName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [nameInputEnabled, setNameInputEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const clearForm = () => {
    setEditingId(null);
    setDesignName("");
    setPrice("");
    setImageUrl(null);
    setSelectedPurposes([]);
    setNameInputEnabled(false);
    setError(null);
  };

  const startEdit = (item: NoshiItem) => {
    setEditingId(item.id);
    setDesignName(item.name);
    setPrice(String(item.price));
    setImageUrl(item.imageUrl);
    setSelectedPurposes(item.supportedPurposes);
    setNameInputEnabled(item.nameInputEnabled);
    setError(null);
    setSaved(false);
  };

  const togglePurpose = (p: string) => {
    setSelectedPurposes((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
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
    if (!designName.trim()) { setError("デザイン名を入力してください"); return; }
    const priceNum = parseInt(price) || 0;
    setSaving(true);
    setError(null);
    const payload = {
      name: designName.trim(),
      imageUrl,
      price: priceNum,
      supportedPurposes: selectedPurposes,
      nameInputEnabled,
    };
    const result = editingId
      ? await updateNoshi(editingId, payload)
      : await addNoshi(payload);
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
    <>
      <div className="flex flex-col gap-6 [@media(min-width:650px)]:flex-row">

        {/* フォーム - LEFT */}
        <div className="flex-1 min-w-0 max-w-lg">
          <h3 className="text-sm font-bold text-gray-700 mb-4">
            {editingId ? "のしを編集" : "のしを新規登録"}
          </h3>

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
                  <img src={imageUrl} alt="のし" className="w-full h-full object-cover" />
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

            {/* Design Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">デザイン名</label>
              <input
                type="text"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="例：蝶結び、のし袋 など"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Supported Purposes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-600">対応用途（複数選択可）</label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPurposes((prev) =>
                      prev.length === NOSHI_PRESETS.length ? [] : [...NOSHI_PRESETS]
                    )
                  }
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      selectedPurposes.length === NOSHI_PRESETS.length
                        ? "bg-amber-400 border-amber-400"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {selectedPurposes.length === NOSHI_PRESETS.length && (
                      <Check size={11} className="text-white" />
                    )}
                  </div>
                  すべて選択
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {NOSHI_PRESETS.map((p) => {
                  const active = selectedPurposes.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePurpose(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? "bg-amber-400 border-amber-400 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              {selectedPurposes.length === 0 && (
                <p className="text-xs text-gray-600 mt-1.5">未選択の場合、顧客側で用途選択ステップが省略されます</p>
              )}
            </div>

            {/* Name input toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setNameInputEnabled((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${nameInputEnabled ? "bg-amber-400" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${nameInputEnabled ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-xs font-bold text-gray-700">名前・会社名の入力を受け付ける</span>
              </label>
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
          <h3 className="text-sm font-bold text-gray-700 mb-3">のし一覧</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <LineSpinner size={20} />
            </div>
          ) : noshiList.length === 0 ? (
            <p className="text-xs text-gray-600 py-4 text-center">のしが登録されていません</p>
          ) : (
            <ul className="space-y-1.5 overflow-y-auto max-h-[480px] pr-1">
              {noshiList.map((item) => {
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
                    <img
                      src={item.imageUrl || "/noshi-default.jpg"}
                      alt=""
                      className="w-9 h-9 object-cover rounded flex-shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-700 truncate">{item.name}</p>
                        {isMaster && (
                          <span className="text-[10px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded shrink-0">共有</span>
                        )}
                      </div>
                      {item.supportedPurposes.length > 0 && (
                        <p className="text-[11px] text-gray-600 truncate mt-0.5">{item.supportedPurposes.join("・")}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">¥{item.price.toLocaleString()}</span>
                        {item.nameInputEnabled && (
                          <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">名前入力あり</span>
                        )}
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
                {deleting ? <LineSpinner size={20} /> : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
