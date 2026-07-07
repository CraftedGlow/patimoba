"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useAuth } from "@/lib/auth-context";
import { LineSpinner } from "@/components/ui/line-spinner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || user.userType !== "admin") {
      router.replace("/login?role=admin");
    }
  }, [loading, user, router]);

  if (loading || !user || user.userType !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LineSpinner size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="ml-14 min-w-0">{children}</main>
    </div>
  );
}
