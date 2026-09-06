"use client"

import { CustomerProvider } from "@/lib/customer-context";
import { CouponBadgeProvider } from "@/lib/coupon-badge-context";
import { CouponDrawer } from "@/components/customer/coupon-drawer";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomerProvider>
      <CouponBadgeProvider>
        <div className="min-h-screen bg-gray-50">
          <div className="min-h-screen bg-white w-full relative safe-pb safe-px-landscape">
            {children}
          </div>
        </div>
        <CouponDrawer />
      </CouponBadgeProvider>
    </CustomerProvider>
  );
}
