"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getStoreIdsWithParent } from "@/lib/store-hierarchy";

const db = supabase as any;

export interface NoshiItem {
  id: string;
  storeId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  displayOrder: number;
  supportedPurposes: string[];
  nameInputEnabled: boolean;
  isMasterItem?: boolean;
}

function toNoshi(row: any, parentStoreId: string | null): NoshiItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    price: row.price ?? 0,
    displayOrder: row.display_order ?? 0,
    supportedPurposes: Array.isArray(row.supported_purposes) ? row.supported_purposes : [],
    nameInputEnabled: row.name_input_enabled ?? false,
    isMasterItem: parentStoreId !== null && row.store_id === parentStoreId,
  };
}

export function useNoshi(storeId: string | undefined) {
  const [noshiList, setNoshiList] = useState<NoshiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { storeIds, parentStoreId } = await getStoreIdsWithParent(storeId);
    const { data } = await db
      .from("noshi")
      .select("*")
      .in("store_id", storeIds)
      .order("display_order", { ascending: true });
    setNoshiList((data ?? []).map((row: any) => toNoshi(row, parentStoreId)));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addNoshi = async (payload: { name: string; imageUrl: string | null; price: number; supportedPurposes: string[]; nameInputEnabled: boolean }) => {
    if (!storeId) return { error: "storeId missing" };
    const { error } = await db.from("noshi").insert({
      store_id: storeId,
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      supported_purposes: payload.supportedPurposes,
      name_input_enabled: payload.nameInputEnabled,
      display_order: noshiList.length,
    });
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const updateNoshi = async (id: string, payload: { name: string; imageUrl: string | null; price: number; supportedPurposes: string[]; nameInputEnabled: boolean }) => {
    const { error } = await db.from("noshi").update({
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      supported_purposes: payload.supportedPurposes,
      name_input_enabled: payload.nameInputEnabled,
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
