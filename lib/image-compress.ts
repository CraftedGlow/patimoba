import { convertHeicIfNeeded } from "./heic-convert"

/** HEIC変換後、Canvasでリサイズ・JPEG圧縮してBlobを返す */
export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85
): Promise<Blob> {
  const source = await convertHeicIfNeeded(file)
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
        (blob) => (blob ? resolve(blob) : reject(new Error("compression failed"))),
        "image/jpeg",
        quality
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(source)
  })
}
