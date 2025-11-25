"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Newspaper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password");
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/admin");
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' && email === 'admin@example.com') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          router.push("/admin");
        } catch (creationError: any) {
          toast({
            variant: "destructive",
            title: "Admin Creation Failed",
            description: creationError.message,
          });
        }
      } else {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Please check your credentials and try again.",
        });
      }
    }
  };
  
  if (isUserLoading || user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
          <div className="w-full max-w-sm p-8 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <Newspaper className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="font-headline text-2xl">The Daily Agent</CardTitle>
          <CardDescription>Admin Panel Login</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            </CardContent>
            <CardFooter>
            <Button type="submit" className="w-full">Login</Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
