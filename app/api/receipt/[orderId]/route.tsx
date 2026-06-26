import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import path from "path";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

Font.register({
  family: "NotoSansJP",
  src: path.join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.otf"),
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: "#1a1a1a",
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 52,
    paddingRight: 52,
  },
  titleBox: {
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: "#1a1a1a",
    borderBottomColor: "#1a1a1a",
    paddingTop: 8,
    paddingBottom: 8,
    textAlign: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    letterSpacing: 8,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    marginBottom: 20,
  },
  recipientName: {
    fontSize: 15,
  },
  honorific: {
    fontSize: 11,
    marginLeft: 2,
    paddingBottom: 1,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 10,
    marginRight: 8,
    paddingBottom: 3,
  },
  amount: {
    fontSize: 26,
  },
  taxIncluded: {
    fontSize: 9,
    color: "#555",
    marginLeft: 4,
    paddingBottom: 3,
  },
  description: {
    fontSize: 10,
    color: "#444",
    marginBottom: 20,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    marginBottom: 10,
    marginTop: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
    color: "#555555",
  },
  discountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 9,
    color: "#2a7a2a",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontSize: 9,
    color: "#444444",
    marginBottom: 20,
  },
  dashedDivider: {
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    marginBottom: 14,
    marginTop: 4,
  },
  storeName: {
    fontSize: 12,
    marginBottom: 4,
  },
  issuerDetail: {
    fontSize: 9,
    color: "#444444",
    marginBottom: 3,
    lineHeight: 1.5,
  },
  invoiceNumber: {
    fontSize: 8,
    color: "#666666",
    marginTop: 6,
  },
});

type OrderData = {
  id: string;
  order_no: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  stores: { name: string; address: string; phone: string | null; invoice_number: string | null } | null;
};

function ReceiptDocument({ order, recipientName, description }: {
  order: OrderData;
  recipientName: string;
  description: string;
}) {
  const total = Number(order.total_amount);
  const tax = Math.floor(total * 10 / 110);
  const pretax = total - tax;
  const hasDiscount = order.discount_amount != null && Number(order.discount_amount) > 0;
  const store = order.stores;

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>領　収　書</Text>
        </View>

        <View style={styles.recipientRow}>
          <Text style={styles.recipientName}>{recipientName || "　"}</Text>
          <Text style={styles.honorific}>　御中</Text>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>金額</Text>
          <Text style={styles.amount}>¥{total.toLocaleString()}</Text>
          <Text style={styles.taxIncluded}>（税込）</Text>
        </View>

        <Text style={styles.description}>但し、{description || "お品代として"}</Text>

        <View style={styles.divider} />

        <View style={styles.breakdownRow}>
          <Text>10% 対象</Text>
          <Text>¥{pretax.toLocaleString()}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text>消費税（10%）</Text>
          <Text>¥{tax.toLocaleString()}</Text>
        </View>
        {hasDiscount && (
          <View style={styles.discountRow}>
            <Text>ポイント割引</Text>
            <Text>-¥{Number(order.discount_amount).toLocaleString()}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.dateRow}>
          <Text>発行日：{dateStr}</Text>
        </View>

        <View style={styles.dashedDivider} />

        <View>
          {store?.name ? <Text style={styles.storeName}>{store.name}</Text> : null}
          {store?.address ? <Text style={styles.issuerDetail}>{store.address}</Text> : null}
          {store?.phone ? <Text style={styles.issuerDetail}>TEL：{store.phone}</Text> : null}
          {store?.invoice_number ? (
            <Text style={styles.invoiceNumber}>登録番号：{store.invoice_number}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  const url = new URL(req.url);
  const recipientName = url.searchParams.get("recipient") ?? "";
  const description = url.searchParams.get("description") ?? "お品代として";

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_no, total_amount, subtotal, discount_amount, stores(name, address, phone, invoice_number)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const buffer = await renderToBuffer(
      <ReceiptDocument
        order={data as unknown as OrderData}
        recipientName={recipientName}
        description={description}
      />
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt_${data.order_no ?? orderId}.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF generation error:", e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
