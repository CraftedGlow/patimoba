import type { ImgHTMLAttributes } from "react";

const LOGO_SRC = "/スクリーンショット_2026-04-09_14.49.59.png";

/** LP ヘッダー等で使うロゴ画像 */
export function PatimobaLogo({
  className,
  alt = "パティモバ",
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={className}
      {...rest}
    />
  );
}

/** 本文中にブランド名をインラインで差し込む（FAQ など） */
export function PatimobaInline({ className }: { className?: string }) {
  return (
    <span
      className={`inline font-bold text-amber-600 whitespace-nowrap ${className ?? ""}`}
    >
      パティモバ
    </span>
  );
}
