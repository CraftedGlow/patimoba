import { convertHeicIfNeeded } from "./heic-convert"

export interface CompressedImage {
  blob: Blob
  contentType: string
  extension: string
}

/**
 * HEIC変換後、Canvasでリサイズして返す。
 * PNG/WebPは透過を持ちうるため、常にJPEGへ変換すると透過部分が黒く塗りつぶされてしまう。
 * そのため元がPNG/WebPの場合はPNGのまま出力し、それ以外（写真系）はJPEGに圧縮する。
 */
export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85
): Promise<CompressedImage> {
  const source = await convertHeicIfNeeded(file)
  const preserveTransparency = source.type === "image/png" || source.type === "image/webp"
  const contentType = preserveTransparency ? "image/png" : "image/jpeg"
  const extension = preserveTransparency ? "png" : "jpg"
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, contentType, extension }) : reject(new Error("compression failed"))),
        contentType,
        preserveTransparency ? undefined : quality
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(source)
  })
}
