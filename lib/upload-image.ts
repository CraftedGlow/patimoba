import { supabase } from "@/lib/supabase"
import { compressImage } from "@/lib/image-compress"

const BUCKET = "product-images"

async function compressOrError(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<{ blob: Blob | null; error: string | null }> {
  try {
    return { blob: await compressImage(file, maxWidth, maxHeight, quality), error: null }
  } catch (e) {
    return { blob: null, error: e instanceof Error ? e.message : "画像の変換に失敗しました" }
  }
}

export async function uploadProductImage(
  file: File,
  storeId: string,
  prefix = "product"
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 1600, 1200, 0.85)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/${prefix}-${Date.now()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
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

export async function uploadDecorationImage(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 1000, 1000, 0.85)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/decoration-${Date.now()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadNoshiImage(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 1000, 1000, 0.85)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/noshi-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadBagImage(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 1000, 1000, 0.85)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/bag-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadPrintPhoto(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  // ケーキに印刷するため、他の画像より高い解像度・画質を維持する
  const { blob, error: compressError } = await compressOrError(file, 2400, 2400, 0.9)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/print-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

const LOGO_BUCKET = "store-logos"

export async function uploadStoreImage(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 1600, 1200, 0.85)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/exterior-${Date.now()}.jpg`

  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadStoreLogo(
  file: File,
  storeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { blob, error: compressError } = await compressOrError(file, 600, 600, 0.88)
  if (!blob) return { url: null, error: compressError }
  const path = `${storeId}/logo-${Date.now()}.jpg`

  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
