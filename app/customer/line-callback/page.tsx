import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { LineCallbackClient } from "./client"

export default async function LineCallbackPage() {
  const cookieStore = await cookies()
  const uid = cookieStore.get("line_session_uid")?.value

  if (!uid) {
    redirect("/customer/login?error=session_expired")
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single()

  if (error || !user) {
    redirect("/customer/login?error=user_not_found")
  }

  return <LineCallbackClient user={user} />
}
