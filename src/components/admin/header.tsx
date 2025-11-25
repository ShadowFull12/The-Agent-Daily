
"use client";

import { signOut } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Newspaper, LogOut, Home } from "lucide-react";
import Link from "next/link";

export function Header() {
  const auth = useAuth();
  const { user } = useUser();

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/admin" className="flex items-center space-x-2">
          <Newspaper className="h-6 w-6 text-primary" />
          <span className="font-bold font-headline text-lg">The Daily Agent</span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                    <Home className="h-5 w-5" />
                    <span className="sr-only">Home</span>
                </Link>
            </Button>
            {user && (
                <>
                    <span className="text-sm text-muted-foreground hidden md:inline-block">
                        {user.email}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Logout</span>
                    </Button>
                </>
            )}
        </div>
      </div>
    </header>
  );
}
