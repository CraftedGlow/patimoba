"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getStoreIdsWithParent } from "@/lib/store-hierarchy";

const db = supabase as any;

export interface CandleItem {
  id: string;
  storeId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  type: "number" | "normal";
  displayOrder: number;
  isMasterItem?: boolean;
}

function toCandle(row: any, parentStoreId: string | null): CandleItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    price: row.price ?? 0,
    type: row.type === "number" ? "number" : "normal",
    displayOrder: row.display_order ?? 0,
    isMasterItem: parentStoreId !== null && row.store_id === parentStoreId,
  };
}

export function useCandles(storeId: string | undefined) {
  const [candleList, setCandleList] = useState<CandleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { storeIds, parentStoreId } = await getStoreIdsWithParent(storeId);
    const { data } = await db
      .from("candles")
      .select("*")
      .in("store_id", storeIds)
      .order("display_order", { ascending: true });
    setCandleList((data ?? []).map((row: any) => toCandle(row, parentStoreId)));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCandle = async (payload: { name: string; imageUrl: string | null; price: number; type: "number" | "normal" }) => {
    if (!storeId) return { error: "storeId missing" };
    const { error } = await db.from("candles").insert({
      store_id: storeId,
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      type: payload.type,
      display_order: candleList.length,
    });
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const updateCandle = async (id: string, payload: { name: string; imageUrl: string | null; price: number; type: "number" | "normal" }) => {
    const { error } = await db.from("candles").update({
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      type: payload.type,
    }).eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const deleteCandle = async (id: string) => {
    const { error } = await db.from("candles").delete().eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  return { candleList, loading, addCandle, updateCandle, deleteCandle, refetch: fetch };
}

export async function fetchCandlesByIds(ids: string[]): Promise<CandleItem[]> {
  if (!ids.length) return [];
  const { data } = await db.from("candles").select("*").in("id", ids);
  return (data ?? []).map((row: any) => toCandle(row, null));
}
