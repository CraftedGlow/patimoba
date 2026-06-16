import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildStarPRNTReceipt } from "@/lib/star-prnt"
import { formatPaymentStatus } from "@/lib/types"

export const dynamic = "force-dynamic"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function log(method: string, storeId: string, message: string, data?: unknown) {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[cloudprnt] ${ts} ${method} storeId=${storeId} ${message}`, data)
  } else {
    console.log(`[cloudprnt] ${ts} ${method} storeId=${storeId} ${message}`)
  }
}

function baseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  const host = req.headers.get("host") ?? ""
  return `${proto}://${host}`
}

// ポーリング
export async function POST(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const body = await req.json().catch(() => ({}))
  log("POST", params.storeId, "polling received", {
    printerMAC: body.printerMAC,
    statusCode: body.statusCode,
    userAgent: req.headers.get("user-agent"),
  })

  const { data: job } = await supabaseAdmin
    .from("print_jobs")
    .select("id, delete_token")
    .eq("store_id", params.storeId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) {
    log("POST", params.storeId, "→ jobReady: false")
    return NextResponse.json({ jobReady: false })
  }

  // jobToken に delete_token を埋め込む → DELETE 時に特定できる
  const jobToken = `${baseUrl(req)}/api/cloudprnt/${params.storeId}?t=${job.delete_token}`
  log("POST", params.storeId, `→ jobReady: true jobToken=${jobToken}`)

  return NextResponse.json({
    jobReady: true,
    mediaTypes: ["application/vnd.star.starprnt"],
    jobToken,
  })
}

// 印刷データ配信
export async function GET(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const url = new URL(req.url)
  const accept = req.headers.get("accept") ?? ""
  const deleteToken = url.searchParams.get("t")

  log("GET", params.storeId, "job data requested", {
    accept,
    deleteToken,
    mac: url.searchParams.get("mac"),
  })

  // jobToken に埋め込んだ delete_token でジョブを特定
  const { data: job } = await (
    deleteToken
      ? supabaseAdmin
          .from("print_jobs")
          .select("id, markup, store_id, order_id")
          .eq("store_id", params.storeId)
          .eq("status", "pending")
          .eq("delete_token", deleteToken)
          .maybeSingle()
      : supabaseAdmin
          .from("print_jobs")
          .select("id, markup, store_id, order_id")
          .eq("store_id", params.storeId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
  )

  if (!job) {
    log("GET", params.storeId, "→ 404 no pending job")
    return new NextResponse("No pending job", { status: 404 })
  }

  await supabaseAdmin
    .from("print_jobs")
    .update({ status: "printing", updated_at: new Date().toISOString() })
    .eq("id", job.id)

  // テスト用バイナリジョブ (_BINARY_BASE64: プレフィックス)
  if (job.markup.startsWith("_BINARY_BASE64:")) {
    const buf = Buffer.from(job.markup.slice("_BINARY_BASE64:".length), "base64")
    log("GET", params.storeId, `→ 200 starprnt(test) jobId=${job.id} bytes=${buf.length}`)
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/vnd.star.starprnt" },
    })
  }

  // 常に StarPRNT バイナリで返す
  // 注文データを再取得してレシートを生成
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, store_id, customer_name_snapshot,
      subtotal, discount_amount, total_amount,
      pickup_date, pickup_time, payment_status, created_at,
      users:users!orders_customer_id_fkey(line_name, phone),
      order_items (
        product_name_snapshot, quantity, unit_price, subtotal,
        variant_name_snapshot,
        order_item_options (
          option_group_name_snapshot,
          option_item_name_snapshot,
          price_delta,
          quantity
        )
      ),
      stores ( name )
    `)
    .eq("id", job.order_id)
    .single()

  if (!order) {
    log("GET", params.storeId, "→ 404 order not found")
    return new NextResponse("Order not found", { status: 404 })
  }

  const users = (order.users as any) ?? {}
  const orderDateFmt = order.created_at
    ? (() => {
        const d = new Date(order.created_at)
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      })()
    : null

  const receiptData = {
    storeName: (order.stores as any)?.name ?? "PATIMOBA",
    orderNo: order.order_no,
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time,
    customerName: order.customer_name_snapshot,
    lineName: users.line_name ?? null,
    phone: users.phone ?? null,
    orderDate: orderDateFmt,
    paymentStatus: formatPaymentStatus(order.payment_status),
    items: ((order.order_items as any[]) ?? []).map((item) => ({
      name: item.product_name_snapshot,
      quantity: item.quantity,
      subtotal: item.subtotal,
      variantName: item.variant_name_snapshot,
      options: (item.order_item_options ?? []).map((opt: any) => ({
        groupName: opt.option_group_name_snapshot,
        itemName: opt.option_item_name_snapshot,
        priceDelta: opt.price_delta,
        quantity: opt.quantity,
      })),
    })),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    totalAmount: order.total_amount,
  }

  const prntBuffer = buildStarPRNTReceipt(receiptData)
  // 先頭20バイトをhexで出力して GS 1D 21 が含まれているか確認する
  log("GET", params.storeId, `→ 200 starprnt jobId=${job.id} bytes=${prntBuffer.length} hex=${prntBuffer.slice(0, 20).toString("hex")}`)

  return new NextResponse(prntBuffer, {
    headers: { "Content-Type": "application/vnd.star.starprnt" },
  })
}

// 印刷完了通知
export async function DELETE(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const url = new URL(req.url)
  const resultCode = url.searchParams.get("code") ?? ""

  // プリンターは token=jobToken_url の形式で送ってくる
  // jobToken には ?t={delete_token} を埋め込んでいるので、そこから取り出す
  const tokenParam = url.searchParams.get("token") ?? url.searchParams.get("deleteToken") ?? ""
  let deleteToken: string | null = null
  try {
    if (tokenParam.startsWith("http")) {
      deleteToken = new URL(tokenParam).searchParams.get("t")
    } else {
      deleteToken = tokenParam || null
    }
  } catch { /* ignore */ }

  const isSuccess = resultCode === "0" || resultCode === "" || resultCode.startsWith("0 ")

  log("DELETE", params.storeId, `print complete`, {
    code: resultCode,
    isSuccess,
    deleteToken,
  })

  if (deleteToken) {
    await supabaseAdmin
      .from("print_jobs")
      .update({
        status: isSuccess ? "done" : "error",
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", params.storeId)
      .eq("delete_token", deleteToken)

    log("DELETE", params.storeId, `→ job marked ${isSuccess ? "done" : "error"} by deleteToken`)
  } else {
    // フォールバック: printing 状態の最古ジョブを更新
    const { data: job } = await supabaseAdmin
      .from("print_jobs")
      .select("id")
      .eq("store_id", params.storeId)
      .eq("status", "printing")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (job) {
      await supabaseAdmin
        .from("print_jobs")
        .update({
          status: isSuccess ? "done" : "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)

      log("DELETE", params.storeId, `→ job marked ${isSuccess ? "done" : "error"} by status fallback`)
    }
  }

  return new NextResponse(null, { status: 200 })
}
