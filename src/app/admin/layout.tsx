
"use client";

import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/admin/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <div className="w-full max-w-md p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
        <Header />
        <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}
