"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getStoreIdsWithParent } from "@/lib/store-hierarchy";

const db = supabase as any;

export interface MessagePlateItem {
  id: string;
  storeId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  displayOrder: number;
  isMasterItem?: boolean;
}

function toMessagePlate(row: any, parentStoreId: string | null): MessagePlateItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    price: row.price ?? 0,
    displayOrder: row.display_order ?? 0,
    isMasterItem: parentStoreId !== null && row.store_id === parentStoreId,
  };
}

export function useMessagePlates(storeId: string | undefined) {
  const [messagePlateList, setMessagePlateList] = useState<MessagePlateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { storeIds, parentStoreId } = await getStoreIdsWithParent(storeId);
    const { data } = await db
      .from("message_plates")
      .select("*")
      .in("store_id", storeIds)
      .order("display_order", { ascending: true });
    setMessagePlateList((data ?? []).map((row: any) => toMessagePlate(row, parentStoreId)));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addMessagePlate = async (payload: { name: string; imageUrl: string | null; price: number }) => {
    if (!storeId) return { error: "storeId missing" };
    const { error } = await db.from("message_plates").insert({
      store_id: storeId,
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
      display_order: messagePlateList.length,
    });
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const updateMessagePlate = async (id: string, payload: { name: string; imageUrl: string | null; price: number }) => {
    const { error } = await db.from("message_plates").update({
      name: payload.name,
      image_url: payload.imageUrl,
      price: payload.price,
    }).eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  const deleteMessagePlate = async (id: string) => {
    const { error } = await db.from("message_plates").delete().eq("id", id);
    if (!error) await fetch();
    return { error: error?.message ?? null };
  };

  return { messagePlateList, loading, addMessagePlate, updateMessagePlate, deleteMessagePlate, refetch: fetch };
}

export async function fetchMessagePlatesByIds(ids: string[]): Promise<MessagePlateItem[]> {
  if (!ids.length) return [];
  const { data } = await db.from("message_plates").select("*").in("id", ids);
  return (data ?? []).map((row: any) => toMessagePlate(row, null));
}
