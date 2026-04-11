"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Menu, X, LogIn } from "lucide-react";
import { PatimobaLogo } from "@/components/patimoba-logo";

const navLinks = [
  { label: "特徴", href: "#features" },
  { label: "できること", href: "#capabilities" },
  { label: "導入の声", href: "#testimonials" },
  { label: "料金", href: "#pricing" },
  { label: "よくある質問", href: "#faq" },
];

export function LpHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <PatimobaLogo className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-gray-600 hover:text-amber-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-amber-600 border border-gray-300 hover:border-amber-400 px-4 py-2 rounded-full transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              ログイン
            </Link>
            <a
              href="#contact"
              className="bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              お問い合わせ
            </a>
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-gray-700" />
            ) : (
              <Menu className="w-5 h-5 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-gray-700 py-2"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 px-5 py-2.5 rounded-full"
              >
                <LogIn className="w-3.5 h-3.5" />
                ログイン
              </Link>
              <a
                href="#contact"
                onClick={() => setMobileOpen(false)}
                className="block bg-amber-400 text-white text-sm font-bold px-5 py-2.5 rounded-full text-center"
              >
                お問い合わせ
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
