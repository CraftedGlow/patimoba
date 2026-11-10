// サーバー（service_role）専用: カート内容の金額をDBの定義から組み立て直す
import { calcItemSubtotal } from "@/lib/cart-pricing";
import { normalizeCustomOptions } from "@/lib/types";
import { resolveStoreIdsWithParent } from "@/lib/coupons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/** クライアントから送られてくるカート1行（UICartItem と同じ形。金額は参考値として扱い、使わない） */
export interface IncomingCartItem {
  productId: string;
  name?: string;
  price?: number;
  quantity: number;
  isEc?: boolean;
  isTakeout?: boolean;
  isCustomCake?: boolean;
  customization?: {
    sizeId?: string;
    sizeLabel?: string;
    sizePrice?: number;
    candles?: { candleOptionId: string; name?: string; price?: number; quantity: number; freeQuantity?: number }[];
    options?: { wholeCakeOptionId: string; name?: string; price?: number; groupName?: string; message?: string }[];
    messagePlate?: string;
    allergyNote?: string;
    printPhotoUrl?: string;
    customOptions?: { name: string; values: string[]; additionalPrice?: number }[];
    noshi?: { id: string; name?: string; purpose?: string; displayName?: string; price?: number };
    messagePlateOption?: { id: string; name?: string; price?: number };
  };
}

export interface PricedCandle {
  candleOptionId: string;
  name: string;
  price: number;
  quantity: number;
  freeQuantity: number;
}

export interface PricedCakeOption {
  wholeCakeOptionId: string;
  name: string;
  price: number;
  groupName: string;
  message?: string;
  /** decorations.id（メッセージプレート種類 `plate-<n>` のようにデコレーション由来でない場合は null） */
  decorationId: string | null;
  shortName: string | null;
}

export interface PricedCustomOption {
  name: string;
  values: string[];
  additionalPrice: number;
  /** 印字用短縮名（カスタムオプション定義の print_short_name を結合したもの。未設定なら null） */
  shortName: string | null;
  /** 商品のカスタムオプション由来なら true（ろうそくを customOptions 形式で持つ場合は false） */
  fromProduct: boolean;
}

/** DBの定義から金額を確定したカート1行 */
export interface PricedCartItem {
  productId: string;
  name: string;
  shortName: string | null;
  price: number;
  quantity: number;
  customization?: {
    sizeId?: string;
    sizeLabel?: string;
    sizePrice?: number;
    candles?: PricedCandle[];
    options?: PricedCakeOption[];
    messagePlate?: string;
    allergyNote?: string;
    customOptions?: PricedCustomOption[];
    noshi?: { id: string; name: string; purpose?: string; displayName?: string; price: number };
    messagePlateOption?: { id: string; name: string; price: number };
  };
}

export interface PricedBag {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type PriceCartResult =
  | { ok: true; items: PricedCartItem[]; subtotal: number }
  | { ok: false; error: string };

export const INVALID_ITEMS_ERROR =
  "ご注文いただけない商品またはオプションが含まれています。お手数ですがカートを確認してください。";

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const MAX_TEXT = 500;

const isQuantity = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QUANTITY;
const text = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_TEXT) : undefined);
const uniq = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.filter((v): v is string => typeof v === "string" && v.length > 0)));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 商品のカスタムオプション定義（印字用短縮名を含む生データ）から、選択値の短縮名を結合する */
function customOptionShortName(rawGroups: unknown, groupName: string, values: string[]): string | null {
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  const group = groups.find((g: any) => g && g.name === groupName) as
    | { values?: { label: string; print_short_name?: string }[] }
    | undefined;
  const groupValues = Array.isArray(group?.values) ? group!.values! : [];
  const hasShortNames = values.some((label) => groupValues.find((v) => v?.label === label)?.print_short_name);
  if (!hasShortNames) return null;
  return values.map((label) => groupValues.find((v) => v?.label === label)?.print_short_name || label).join("、");
}

/**
 * カート内容の金額をクライアント申告値ではなくDBの商品・オプション定義から組み立て直す。
 * 各画面がカートに入れる内容と同じ計算をサーバー側で行う（合計は lib/cart-pricing.ts の calcItemSubtotal）:
 *   - EC商品（app/customer/ec/product/[id]）: 商品本体価格・カスタムオプション・のし・メッセージプレート
 *   - テイクアウト商品（app/customer/takeout/product/[id]）: 上記 + ろうそく（customOptions 形式）
 *   - ホールケーキ（app/customer/takeout/whole-cake）: サイズ（product_variants）・ろうそく（candles）・
 *     デコレーション（decorations。商品に紐付いたグループ、またはプリントデコレーション）・
 *     メッセージプレート種類（商品のカスタムオプション「メッセージプレート」）・のし
 * DBに存在しない／その商品で選べない選択肢が含まれている場合は注文を受け付けない。
 */
export async function priceCartItems(
  supabaseAdmin: AdminClient,
  storeId: string,
  items: IncomingCartItem[],
  channel: "ec" | "takeout"
): Promise<PriceCartResult> {
  const invalid: PriceCartResult = { ok: false, error: INVALID_ITEMS_ERROR };
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return invalid;
  if (items.some((i) => !i || typeof i.productId !== "string")) return invalid;

  const storeIds = await resolveStoreIdsWithParent(storeId, supabaseAdmin);
  const productIds = uniq(items.map((i) => i.productId));
  const { data: products } = await supabaseAdmin
    .from("products")
    .select(
      "id, name, print_short_name, base_price, store_id, is_ec, is_preorder_required, custom_options, noshi_ids, message_plate_ids, candle_enabled, candle_ids, print_decoration_enabled"
    )
    .in("id", productIds);
  const productMap = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));

  const customizations = items.map((i) => i.customization).filter(Boolean) as NonNullable<IncomingCartItem["customization"]>[];
  const noshiIds = uniq(customizations.map((c) => c.noshi?.id));
  const plateIds = uniq(customizations.map((c) => c.messagePlateOption?.id));
  const sizeIds = uniq(customizations.map((c) => c.sizeId));
  // ろうそくは商品に設定された candle_ids の範囲でのみ選べる（customOptions 形式の照合のため商品側の全件を取得）
  const candleIds =
    channel === "takeout"
      ? uniq((products ?? []).flatMap((p: any) => (p.candle_enabled && Array.isArray(p.candle_ids) ? p.candle_ids : [])))
      : [];
  const decorationIds = uniq(
    customizations.flatMap((c) => (c.options ?? []).map((o) => o?.wholeCakeOptionId)).filter((id) => UUID_RE.test(String(id)))
  );
  const cakeProductIds = (products ?? []).filter((p: any) => p.is_preorder_required).map((p: any) => p.id);
  // クリスマス注文の追加オプションチェックボックス: ラベルはクライアント申告値を使わず、
  // 店舗設定（stores.christmas_checkbox_label）から取得する
  const hasChristmasExtraOption = customizations.some((c) =>
    (c.options ?? []).some((o) => o?.wholeCakeOptionId === "christmas-extra-option")
  );

  const empty = Promise.resolve({ data: [] as any[] });
  const [noshiRes, plateRes, sizeRes, candleRes, decorationRes, linkedGroupRes, christmasOptRes] = await Promise.all([
    noshiIds.length ? supabaseAdmin.from("noshi").select("id, name, price").in("id", noshiIds) : empty,
    plateIds.length ? supabaseAdmin.from("message_plates").select("id, name, price").in("id", plateIds) : empty,
    channel === "takeout" && sizeIds.length
      ? supabaseAdmin.from("product_variants").select("id, product_id, name, price").in("id", sizeIds)
      : empty,
    candleIds.length ? supabaseAdmin.from("candles").select("id, name, price, type, free_quantity").in("id", candleIds) : empty,
    channel === "takeout" && decorationIds.length
      ? supabaseAdmin
          .from("decorations")
          .select("id, store_id, name, print_short_name, price, category, is_active")
          .in("id", decorationIds)
      : empty,
    channel === "takeout" && cakeProductIds.length && decorationIds.length
      ? supabaseAdmin
          .from("product_decoration_groups")
          .select("product_id, decoration_groups ( id, name, decoration_group_items ( decoration_id ) )")
          .in("product_id", cakeProductIds)
      : empty,
    hasChristmasExtraOption
      ? supabaseAdmin.from("stores").select("christmas_checkbox_label").eq("id", storeId).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);
  const christmasCheckboxLabel: string | null = christmasOptRes?.data?.christmas_checkbox_label ?? null;
  const noshiMap = new Map<string, any>((noshiRes.data ?? []).map((n: any) => [n.id, n]));
  const plateMap = new Map<string, any>((plateRes.data ?? []).map((m: any) => [m.id, m]));
  const sizeMap = new Map<string, any>((sizeRes.data ?? []).map((s: any) => [s.id, s]));
  const candleMap = new Map<string, any>((candleRes.data ?? []).map((c: any) => [c.id, c]));
  const decorationMap = new Map<string, any>((decorationRes.data ?? []).map((d: any) => [d.id, d]));
  // 商品ID → その商品に紐付いたデコレーショングループ（グループ名と含まれるデコレーションID）
  const linkedGroups = new Map<string, { name: string; decorationIds: string[] }[]>();
  for (const row of linkedGroupRes.data ?? []) {
    const g = (row as any).decoration_groups;
    if (!g) continue;
    const list = linkedGroups.get((row as any).product_id) ?? [];
    list.push({
      name: g.name || "",
      decorationIds: ((g.decoration_group_items ?? []) as any[]).map((gi) => String(gi.decoration_id)),
    });
    linkedGroups.set((row as any).product_id, list);
  }

  const priced: PricedCartItem[] = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || !storeIds.includes(product.store_id)) return invalid;
    const quantity = Number(item.quantity);
    if (!isQuantity(quantity)) return invalid;

    const c = item.customization;
    const isCake = !!item.isCustomCake;

    if (channel === "ec") {
      // ホールケーキ用のサイズ・ろうそく・デコレーションはEC商品には存在しない
      if (!product.is_ec || isCake || c?.sizeId || c?.candles?.length || c?.options?.length) return invalid;
    } else {
      if (item.isEc) return invalid;
      // ホールケーキはカスタマイズ画面（サイズ選択必須）からのみカートに入る
      if (isCake !== !!product.is_preorder_required) return invalid;
      if (isCake && !c?.sizeId) return invalid;
      if (!isCake && (c?.sizeId || c?.candles?.length || c?.options?.length)) return invalid;
    }

    const productCandleIds: string[] =
      channel === "takeout" && product.candle_enabled && Array.isArray(product.candle_ids) ? product.candle_ids : [];

    let customization: PricedCartItem["customization"] | undefined;
    if (c) {
      customization = {};

      // サイズ（ホールケーキ）
      if (c.sizeId) {
        const size = sizeMap.get(c.sizeId);
        if (!size || size.product_id !== product.id) return invalid;
        customization.sizeId = size.id;
        customization.sizeLabel = size.name || "";
        customization.sizePrice = Number(size.price) || 0;
      }

      // ろうそく（ホールケーキ）。無料個数は calcCandleTotal で candleOptionId ごとにまとめて差し引く
      if (c.candles?.length) {
        const candles: PricedCandle[] = [];
        for (const cd of c.candles) {
          const row = candleMap.get(cd?.candleOptionId);
          const candleQty = Number(cd?.quantity);
          if (!row || !productCandleIds.includes(row.id) || !isQuantity(candleQty)) return invalid;
          // ナンバー型は「名前(数字)」の表記で数字を持つ（whole-cake/page.tsx の buildCartItem と同じ）
          let name = row.name || "";
          if (row.type === "number") {
            const digit = typeof cd.name === "string" && cd.name.startsWith(`${row.name}(`) && cd.name.endsWith(")")
              ? cd.name.slice(row.name.length + 1, -1)
              : "";
            if (/^[0-9]{1,3}$/.test(digit)) name = `${row.name}(${digit})`;
          }
          candles.push({
            candleOptionId: row.id,
            name,
            price: Number(row.price) || 0,
            quantity: candleQty,
            freeQuantity: Number(row.free_quantity) || 0,
          });
        }
        customization.candles = candles;
      }

      // デコレーション・メッセージプレート種類（ホールケーキ）
      if (c.options?.length) {
        const options: PricedCakeOption[] = [];
        for (const op of c.options) {
          const optionId = String(op?.wholeCakeOptionId ?? "");
          const plateMatch = /^plate-(\d+)$/.exec(optionId);
          if (plateMatch) {
            // 商品のカスタムオプション「メッセージプレート」の n 番目の選択肢（whole-cake/page.tsx と同じ参照）
            const rawGroups = Array.isArray(product.custom_options) ? product.custom_options : [];
            const plateGroup = rawGroups.find((g: any) => g && g.name === "メッセージプレート");
            const plateSize = Array.isArray(plateGroup?.values) ? plateGroup.values[Number(plateMatch[1])] : undefined;
            if (!plateSize || typeof plateSize !== "object") return invalid;
            options.push({
              wholeCakeOptionId: optionId,
              name: String(plateSize.label ?? ""),
              price: Number(plateSize.additional_price) || 0,
              groupName: "メッセージプレート",
              decorationId: null,
              shortName: null,
            });
            continue;
          }

          if (optionId === "christmas-extra-option") {
            // 店舗がクリスマス注文用に設定した追加オプションチェックボックス。
            // ラベルはクライアント申告値を使わず、店舗設定（christmasCheckboxLabel）から取得する
            if (!christmasCheckboxLabel) return invalid;
            options.push({
              wholeCakeOptionId: optionId,
              name: christmasCheckboxLabel,
              price: 0,
              groupName: "追加オプション",
              decorationId: null,
              shortName: null,
            });
            continue;
          }

          const deco = decorationMap.get(optionId);
          if (!deco || deco.is_active === false) return invalid;
          const groupsWithDeco = (linkedGroups.get(product.id) ?? []).filter((g) => g.decorationIds.includes(deco.id));
          const isPrint = deco.category === "print";
          // プリントデコレーションは、グループ紐付けがなくても print_decoration_enabled の商品で選べる
          const printAllowed = isPrint && product.print_decoration_enabled && storeIds.includes(deco.store_id);
          if (groupsWithDeco.length === 0 && !printAllowed) return invalid;
          const groupName = isPrint
            ? "プリントデコレーション"
            : (groupsWithDeco.find((g) => g.name === op.groupName) ?? groupsWithDeco[0]).name;
          options.push({
            wholeCakeOptionId: deco.id,
            name: deco.name || "",
            price: Number(deco.price) || 0,
            groupName,
            // プレート系デコレーションのみメッセージを持てる
            ...(deco.category === "plate" && text(op.message) ? { message: text(op.message) } : {}),
            decorationId: deco.id,
            shortName: deco.print_short_name ?? null,
          });
        }
        customization.options = options;
      }

      // カスタムオプション（テイクアウト商品ではろうそくも同じ形式で入る）
      if (c.customOptions?.length) {
        const groups = normalizeCustomOptions(product.custom_options);
        const customOptions: PricedCustomOption[] = [];
        for (const co of c.customOptions) {
          const values = Array.isArray(co?.values) ? co.values.map((v) => String(v)) : [];
          if (values.length === 0) return invalid;
          const group = groups.find((g) => g.name === co.name);

          if (group?.type === "text") {
            customOptions.push({ name: group.name, values: [values[0].slice(0, MAX_TEXT)], additionalPrice: 0, shortName: null, fromProduct: true });
            continue;
          }
          if (group && values.every((label) => group.values.some((v) => v.label === label))) {
            const additionalPrice = group.values
              .filter((v) => values.includes(v.label))
              .reduce((s, v) => s + (v.additional_price || 0), 0);
            customOptions.push({
              name: group.name,
              values,
              additionalPrice,
              shortName: customOptionShortName(product.custom_options, group.name, values),
              fromProduct: true,
            });
            continue;
          }

          // テイクアウト商品のろうそく（takeout/product/[id] の candleCartOptions と同じ計算）
          const candle = !product.is_preorder_required
            ? productCandleIds.map((id) => candleMap.get(id)).find((row) => row && row.name === co.name)
            : undefined;
          if (!candle) return invalid;
          const free = Number(candle.free_quantity) || 0;
          const price = Number(candle.price) || 0;
          if (candle.type === "number") {
            // 選んだ数字を本数分並べた配列（例: ["1","1","5"]）
            if (values.length > MAX_QUANTITY || values.some((d) => !/^[0-9]$/.test(d))) return invalid;
            customOptions.push({ name: candle.name, values, additionalPrice: Math.max(0, values.length - free) * price, shortName: null, fromProduct: false });
          } else {
            if (values.length !== 1 || values[0] !== candle.name) return invalid;
            customOptions.push({ name: candle.name, values, additionalPrice: Math.max(0, 1 - free) * price, shortName: null, fromProduct: false });
          }
        }
        customization.customOptions = customOptions;
      }

      // のし
      if (c.noshi) {
        const row = noshiMap.get(c.noshi.id);
        if (!row || !(product.noshi_ids ?? []).includes(c.noshi.id)) return invalid;
        customization.noshi = {
          id: row.id,
          name: row.name,
          purpose: text(c.noshi.purpose) || undefined,
          displayName: text(c.noshi.displayName) || undefined,
          price: Number(row.price) || 0,
        };
      }

      // メッセージプレート（商品に設定されたデザインから選ぶ方式）
      if (c.messagePlateOption) {
        const row = plateMap.get(c.messagePlateOption.id);
        if (!row || !(product.message_plate_ids ?? []).includes(c.messagePlateOption.id)) return invalid;
        customization.messagePlateOption = { id: row.id, name: row.name, price: Number(row.price) || 0 };
      }

      // メッセージ本文・アレルギー（金額に影響しない入力値）
      // EC はメッセージプレートを選んだ場合のみメッセージを持つ（従来の priceEcItems と同じ）
      const messagePlate = text(c.messagePlate);
      if (messagePlate && (channel === "takeout" || customization.messagePlateOption)) customization.messagePlate = messagePlate;
      if (channel === "takeout" && text(c.allergyNote)) customization.allergyNote = text(c.allergyNote);
    }

    priced.push({
      productId: product.id,
      name: product.name,
      shortName: product.print_short_name ?? null,
      // ホールケーキは本体価格を持たずサイズ価格で決まる（whole-cake/page.tsx は price: 0 でカートに入れる）
      price: isCake ? 0 : Number(product.base_price) || 0,
      quantity,
      customization,
    });
  }

  const subtotal = priced.reduce((sum, item) => sum + calcItemSubtotal(item), 0);
  return { ok: true, items: priced, subtotal };
}

/**
 * テイクアウトの袋（takeout/bag/page.tsx で選ぶ注文全体への追加）の金額をDBの定義から確定する。
 * 有効な袋で、カート内のいずれかの商品に対応しているものに限る。
 */
export async function priceBag(
  supabaseAdmin: AdminClient,
  storeId: string,
  bag: { id?: string; quantity?: number } | null | undefined,
  cartProductIds: string[]
): Promise<{ ok: true; bag: PricedBag | null } | { ok: false; error: string }> {
  if (!bag) return { ok: true, bag: null };
  const quantity = Number(bag.quantity);
  if (typeof bag.id !== "string" || !isQuantity(quantity)) return { ok: false, error: INVALID_ITEMS_ERROR };

  const storeIds = await resolveStoreIdsWithParent(storeId, supabaseAdmin);
  const { data: row } = await supabaseAdmin
    .from("bags")
    .select("id, store_id, name, price, product_ids, is_active")
    .eq("id", bag.id)
    .maybeSingle();
  const productIds: string[] = Array.isArray(row?.product_ids) ? row.product_ids : [];
  if (
    !row ||
    row.is_active === false ||
    !storeIds.includes(row.store_id) ||
    !productIds.some((id) => cartProductIds.includes(id))
  ) {
    return { ok: false, error: INVALID_ITEMS_ERROR };
  }
  return { ok: true, bag: { id: row.id, name: row.name, unitPrice: Number(row.price) || 0, quantity } };
}
