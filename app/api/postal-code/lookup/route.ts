import { NextRequest, NextResponse } from "next/server";

// GET /api/postal-code/lookup?zipcode=1500001
// zipcloud (https://zipcloud.ibsnet.co.jp/) をサーバー経由でプロキシし、
// 郵便番号から都道府県・市区町村を返す
export async function GET(req: NextRequest) {
  const zipcode = req.nextUrl.searchParams.get("zipcode")?.replace(/[^0-9]/g, "");

  if (!zipcode || zipcode.length !== 7) {
    return NextResponse.json({ error: "郵便番号は7桁の数字で指定してください" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (data.status !== 200 || !data.results?.length) {
      return NextResponse.json({ prefecture: null, city: null });
    }

    const result = data.results[0];
    return NextResponse.json({
      prefecture: result.address1 as string,
      city: result.address2 as string,
    });
  } catch {
    return NextResponse.json({ error: "住所の取得に失敗しました" }, { status: 500 });
  }
}
