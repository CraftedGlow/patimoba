"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  basePath: string;
}

export function ProductCard({ product, basePath }: ProductCardProps) {
  const href =
    product.category === "ホール"
      ? `${basePath}/whole-cake?product=${product.id}`
      : `${basePath}/product/${product.id}`;

  return (
    <Link href={href}>
      <motion.div
        className="group cursor-pointer"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-gray-900">
          &yen;{product.price.toLocaleString()}
        </p>
      </motion.div>
    </Link>
  );
}
