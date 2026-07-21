/** HEIC/HEIF画像はSafari以外でデコードできないため、アップロード前にJPEGへ変換する */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  const { isHeic, heicTo } = await import("heic-to")

  if (!(await isHeic(file))) return file

  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.85 })
  const newName = file.name.replace(/\.hei[cf]$/i, ".jpg") || "converted.jpg"

  return new File([blob], newName, { type: "image/jpeg" })
}
