import { supabase } from "@/lib/supabase"

const BUCKET = "product-images"

export async function uploadProductImage(
  file: File,
  storeId: string,
  prefix = "product"
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() || "jpg"
  const path = `${storeId}/${prefix}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function deleteProductImage(
  url: string
): Promise<{ error: string | null }> {
  const parts = url.split(`/storage/v1/object/public/${BUCKET}/`)
  if (parts.length < 2) return { error: "Invalid URL" }
  const path = parts[1]
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error?.message || null }
}

export async function uploadStoreLogo(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() || "jpg"
  const path = `${storeId}/logo-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
