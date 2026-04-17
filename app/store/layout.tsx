"use client"

import { StoreSidebar } from "@/components/store/sidebar";
import { StoreProvider } from "@/lib/store-context";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden bg-white">
        <StoreSidebar />
        <main className="flex-1 overflow-y-auto store-scope pt-0 lg:pt-0">
          {/* モバイルでハンバーガーボタン分の余白 */}
          <div className="h-12 lg:hidden" />
          {children}
        </main>
      </div>
    </StoreProvider>
  );
}
