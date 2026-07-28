"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const db = supabase as any;

export interface BagItem {
  id: string;
  storeId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  capacity: number;
  productIds: string[];
  isActive: boolean;
  displayOrder: number;
}

function toBag(row: any): BagItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    price: row.price ?? 0,
    capacity: row.capacity ?? 1,
    productIds: Array.isArray(row.product_ids) ? row.product_ids : [],
    isActive: row.is_active ?? true,
    displayOrder: row.display_order ?? 0,
  };
}

export function useBags(storeId: string | undefined) {
  const [bags, setBags] = useState<BagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await db
      .from("bags")
      .select("*")
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });
    setBags((data ?? []).map(toBag));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addBag = async (payload: { name: string; imageUrl: string | null; price: number; capacity: number; productIds: string[] }) => {
    if (!storeId) return { error: "storeId missing" };
    const { error } = await db.from("bags").insert({
      store_id: storeId,
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      capacity: payload.capacity,
      product_ids: payload.productIds,
      display_order: bags.length,
    });
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const updateBag = async (id: string, payload: { name: string; imageUrl: string | null; price: number; capacity: number; productIds: string[]; isActive: boolean }) => {
    const { error } = await db.from("bags").update({
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      capacity: payload.capacity,
      product_ids: payload.productIds,
      is_active: payload.isActive,
    }).eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const deleteBag = async (id: string) => {
    const { error } = await db.from("bags").delete().eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  return { bags, loading, addBag, updateBag, deleteBag, refetch: fetch };
}
