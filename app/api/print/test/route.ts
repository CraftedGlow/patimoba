import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import iconv from "iconv-lite"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESC = 0x1b
const GS  = 0x1d

function cmd(...bytes: number[]): Buffer { return Buffer.from(bytes) }
function line(str: string): Buffer { return iconv.encode(str + "\n", "Shift_JIS") }
function blank(): Buffer { return iconv.encode("\n", "Shift_JIS") }

function size(n: number): Buffer {
  return Buffer.concat([
    cmd(ESC, 0x68, n),
    cmd(ESC, 0x57, n),
  ])
}

function buildSizeTestReceipt(): Buffer {
  const parts: Buffer[] = [
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x00),
    blank(),
  ]

  for (let n = 1; n <= 4; n++) {
    parts.push(size(n))
    parts.push(line(`${n}x: サイズ ABC 123`))
  }

  parts.push(size(1))
  parts.push(blank())
  parts.push(cmd(ESC, 0x64, 0x03))
  parts.push(cmd(GS,  0x56, 0x41, 0x00))

  return Buffer.concat(parts)
}

// POST /api/print/test  body: { storeId: "..." }
export async function POST(req: NextRequest) {
  const { storeId } = await req.json().catch(() => ({}))
  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 })
  }

  const binary = buildSizeTestReceipt()
  const markup = "_BINARY_BASE64:" + binary.toString("base64")

  const { error } = await supabaseAdmin
    .from("print_jobs")
    .insert({ store_id: storeId, markup })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
