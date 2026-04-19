"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const db = supabase as any;

export interface NoshiItem {
  id: string;
  storeId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  displayOrder: number;
}

function toNoshi(row: any): NoshiItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    price: row.price ?? 0,
    displayOrder: row.display_order ?? 0,
  };
}

export function useNoshi(storeId: string | undefined) {
  const [noshiList, setNoshiList] = useState<NoshiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db
      .from("noshi")
      .select("*")
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });
    setNoshiList((data ?? []).map(toNoshi));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addNoshi = async (payload: { name: string; imageUrl: string | null; price: number }) => {
    if (!storeId) return { error: "storeId missing" };
    const { error } = await db.from("noshi").insert({
      store_id: storeId,
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      display_order: noshiList.length,
    });
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const updateNoshi = async (id: string, payload: { name: string; imageUrl: string | null; price: number }) => {
    const { error } = await db.from("noshi").update({
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
    }).eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const deleteNoshi = async (id: string) => {
    const { error } = await db.from("noshi").delete().eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  return { noshiList, loading, addNoshi, updateNoshi, deleteNoshi, refetch: fetch };
}

export async function fetchNoshiByIds(ids: string[]): Promise<NoshiItem[]> {
  if (!ids.length) return [];
  const { data } = await db.from("noshi").select("*").in("id", ids);
  return (data ?? []).map(toNoshi);
}
