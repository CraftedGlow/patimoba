"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type SubTab = "基本" | "ろうそく" | "オプション";

interface CandleRow {
  id: string;
  name: string;
  price: number;
}

interface OptionRow {
  id: string;
  name: string;
  price: number;
  multiple_allowed: boolean;
}

interface StoreCustomSettings {
  whole_cake_order_days: number;
  whole_cake_max_daily: number;
  print_deco_enabled: boolean;
  print_deco_order_days: number;
  print_deco_max_daily: number;
  print_deco_price: number;
  message_plate_types: string[];
}

const DEFAULT_SETTINGS: StoreCustomSettings = {
  whole_cake_order_days: 1,
  whole_cake_max_daily: 10,
  print_deco_enabled: true,
  print_deco_order_days: 7,
  print_deco_max_daily: 10,
  print_deco_price: 1500,
  message_plate_types: ["ホワイトチョコ"],
};

const MESSAGE_PLATE_CHOICES = ["ホワイトチョコ", "ダークチョコ", "クッキー"];

export function CustomTab() {
  const { user } = useAuth();
  const storeId = user?.storeId ?? null;

  const [subTab, setSubTab] = useState<SubTab>("基本");
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreCustomSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMultiple, setNewMultiple] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editMultiple, setEditMultiple] = useState(false);

  const numberOptions = Array.from({ length: 30 }, (_, i) => i);

  const fetchData = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [candleRes, optionRes] = await Promise.all([
        supabase
          .from("candle_options")
          .select("id, name, price")
          .eq("store_id", storeId)
          .order("sort_order"),
        supabase
          .from("whole_cake_options")
          .select("id, name, price, multiple_allowed")
          .order("sort_order"),
      ]);

      if (candleRes.error) throw candleRes.error;
      if (optionRes.error) throw optionRes.error;

      setCandles(candleRes.data ?? []);
      setOptions(
        (optionRes.data ?? []).map((o: any) => ({
          id: o.id,
          name: o.name,
          price: o.price,
          multiple_allowed: o.multiple_allowed ?? false,
        }))
      );

      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .single();

      if (storeData) {
        const meta = (storeData as any).custom_settings;
        if (meta && typeof meta === "object") {
          setSettings({ ...DEFAULT_SETTINGS, ...meta });
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleSaveSettings = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      showToast("保存しました");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleAddCandle = async () => {
    if (!storeId || !newName.trim()) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from("candle_options").insert({
        store_id: storeId,
        name: newName.trim(),
        price: parseInt(newPrice) || 0,
      });
      if (err) throw err;
      await fetchData();
      setNewName("");
      setNewPrice("");
      showToast("ろうそくを追加しました");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleUpdateCandle = async (id: string) => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("candle_options")
        .update({ name: editName.trim(), price: parseInt(editPrice) || 0 })
        .eq("id", id);
      if (err) throw err;
      await fetchData();
      setEditId(null);
      showToast("保存しました");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDeleteCandle = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from("candle_options")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddOption = async () => {
    if (!newName.trim()) return;

    const wholeCakeRes = await supabase
      .from("whole_cake_products")
      .select("id")
      .eq("store_id", storeId!)
      .limit(1)
      .single();

    if (!wholeCakeRes.data) {
      setError("ホールケーキ商品が登録されていません。先にホールケーキ商品を登録してください。");
      return;
    }

    setSaving(true);
    try {
      const { error: err } = await supabase.from("whole_cake_options").insert({
        whole_cake_product_id: wholeCakeRes.data.id,
        name: newName.trim(),
        price: parseInt(newPrice) || 0,
        multiple_allowed: newMultiple,
      });
      if (err) throw err;
      await fetchData();
      setNewName("");
      setNewPrice("");
      setNewMultiple(false);
      showToast("オプションを追加しました");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleUpdateOption = async (id: string) => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("whole_cake_options")
        .update({
          name: editName.trim(),
          price: parseInt(editPrice) || 0,
          multiple_allowed: editMultiple,
        })
        .eq("id", id);
      if (err) throw err;
      await fetchData();
      setEditId(null);
      showToast("保存しました");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDeleteOption = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from("whole_cake_options")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (item: { id: string; name: string; price: number; multiple_allowed?: boolean }) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditMultiple(item.multiple_allowed ?? false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-6">商品登録画面</h2>

      <div className="flex gap-6">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFF9C4] rounded-xl p-4"
          >
            {/* サブタブ */}
            <div className="flex border-b border-amber-300 mb-4">
              {(["基本", "ろうそく", "オプション"] as SubTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setSubTab(tab);
                    setEditId(null);
                    setNewName("");
                    setNewPrice("");
                  }}
                  className={`px-5 py-2 text-sm font-bold transition-colors ${
                    subTab === tab
                      ? "text-gray-900 border-b-2 border-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 基本タブ */}
            {subTab === "基本" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex gap-12">
                  {/* ホールケーキ設定 */}
                  <div className="flex-1 space-y-4">
                    <h3 className="text-base font-bold text-amber-700">
                      〈ホールケーキ〉
                    </h3>
                    <div>
                      <label className="text-sm font-medium block mb-1">
                        ホールケーキの受付日
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={settings.whole_cake_order_days}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              whole_cake_order_days: Number(e.target.value),
                            }))
                          }
                          className="w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          {numberOptions.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm">日前</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">
                        ホールケーキの1日の最大個数
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={settings.whole_cake_max_daily}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              whole_cake_max_daily: Number(e.target.value),
                            }))
                          }
                          className="w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            )
                          )}
                        </select>
                        <span className="text-sm">個まで</span>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      保存
                    </motion.button>
                  </div>

                  {/* プリントデコレーション設定 */}
                  <div className="flex-1 space-y-4">
                    <h3 className="text-base font-bold text-amber-700">
                      〈プリントデコレーション〉
                    </h3>
                    <div>
                      <label className="text-sm font-medium block mb-1">
                        プリントデコレーション
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            checked={settings.print_deco_enabled}
                            onChange={() =>
                              setSettings((s) => ({
                                ...s,
                                print_deco_enabled: true,
                              }))
                            }
                            className="accent-blue-600 w-4 h-4"
                          />
                          できる
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            checked={!settings.print_deco_enabled}
                            onChange={() =>
                              setSettings((s) => ({
                                ...s,
                                print_deco_enabled: false,
                              }))
                            }
                            className="accent-blue-600 w-4 h-4"
                          />
                          できない
                        </label>
                      </div>
                    </div>
                    <AnimatePresence>
                      {settings.print_deco_enabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div>
                            <label className="text-sm font-medium block mb-1">
                              プリントデコの受付日
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={settings.print_deco_order_days}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    print_deco_order_days: Number(
                                      e.target.value
                                    ),
                                  }))
                                }
                                className="w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                              >
                                {numberOptions.map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                              <span className="text-sm">日前</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium block mb-1">
                              プリントデコの1日の最大注文数
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                value={settings.print_deco_max_daily}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    print_deco_max_daily: Number(
                                      e.target.value
                                    ),
                                  }))
                                }
                                className="w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                              >
                                {Array.from({ length: 20 }, (_, i) => i + 1).map(
                                  (n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  )
                                )}
                              </select>
                              <span className="text-sm">個まで</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium block mb-1">
                              プリントデコレーションの金額
                            </label>
                            <input
                              type="text"
                              value={`¥${settings.print_deco_price.toLocaleString()}`}
                              onChange={(e) => {
                                const v = parseInt(
                                  e.target.value.replace(/[¥,\s]/g, ""),
                                  10
                                );
                                setSettings((s) => ({
                                  ...s,
                                  print_deco_price: isNaN(v) ? 0 : v,
                                }));
                              }}
                              className="w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      保存
                    </motion.button>
                  </div>
                </div>

                {/* メッセージプレート */}
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-amber-700">
                    〈メッセージプレートの種類〉
                  </h3>
                  {MESSAGE_PLATE_CHOICES.map((plate) => (
                    <label
                      key={plate}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={settings.message_plate_types.includes(plate)}
                        onChange={() =>
                          setSettings((s) => {
                            const types = s.message_plate_types.includes(plate)
                              ? s.message_plate_types.filter(
                                  (t) => t !== plate
                                )
                              : [...s.message_plate_types, plate];
                            return { ...s, message_plate_types: types };
                          })
                        }
                        className="w-4 h-4 accent-blue-600"
                      />
                      {plate}
                    </label>
                  ))}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    保存
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ろうそくタブ */}
            {subTab === "ろうそく" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <AnimatePresence mode="popLayout">
                  {candles.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      layout
                      className="flex items-center gap-3"
                    >
                      {editId === item.id ? (
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 border border-amber-400 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300"
                          />
                          <input
                            type="text"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 border border-amber-400 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300"
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleUpdateCandle(item.id)}
                            disabled={saving}
                            className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                          </motion.button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={item.name}
                            readOnly
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
                            onClick={() => startEdit(item)}
                          />
                          <input
                            type="text"
                            value={`¥${item.price.toLocaleString()}`}
                            readOnly
                            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
                            onClick={() => startEdit(item)}
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => startEdit(item)}
                            className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            保存
                          </motion.button>
                          <button
                            onClick={() => handleDeleteCandle(item.id)}
                            className="text-gray-500 hover:text-red-500 p-1 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="flex items-center gap-3 pt-2 border-t border-amber-200">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="名前"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="¥0"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleAddCandle}
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* オプションタブ */}
            {subTab === "オプション" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <AnimatePresence mode="popLayout">
                  {options.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      layout
                      className="flex items-center gap-3"
                    >
                      {editId === item.id ? (
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 border border-amber-400 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300"
                          />
                          <input
                            type="text"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 border border-amber-400 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-amber-300"
                          />
                          <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={editMultiple}
                              onChange={(e) => setEditMultiple(e.target.checked)}
                              className="w-3.5 h-3.5"
                            />
                            複数
                          </label>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleUpdateOption(item.id)}
                            disabled={saving}
                            className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                          </motion.button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={item.name}
                            readOnly
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
                            onClick={() => startEdit(item)}
                          />
                          <input
                            type="text"
                            value={`¥${item.price.toLocaleString()}`}
                            readOnly
                            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
                            onClick={() => startEdit(item)}
                          />
                          <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={item.multiple_allowed}
                              readOnly
                              className="w-3.5 h-3.5 pointer-events-none"
                            />
                            複数
                          </label>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => startEdit(item)}
                            className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            保存
                          </motion.button>
                          <button
                            onClick={() => handleDeleteOption(item.id)}
                            className="text-gray-500 hover:text-red-500 p-1 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="flex items-center gap-3 pt-2 border-t border-amber-200">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="名前"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="¥0"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={newMultiple}
                      onChange={(e) => setNewMultiple(e.target.checked)}
                      className="w-3.5 h-3.5"
                    />
                    複数
                  </label>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleAddOption}
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* 右サイドパネル（タグ一覧） */}
        {(subTab === "ろうそく" || subTab === "オプション") && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-72"
          >
            <div className="flex flex-wrap gap-2">
              {(subTab === "ろうそく" ? candles : options).map((item) => (
                <motion.span
                  key={item.id}
                  layout
                  whileHover={{ scale: 1.05 }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm cursor-default"
                >
                  {item.name}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* エラー表示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between"
          >
            {error}
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* トースト */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={() => setToastMsg(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setToastMsg(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-lg font-bold text-center flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                {toastMsg}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
