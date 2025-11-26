
import { collection, query, orderBy, limit, getDocs, getFirestore } from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import { Edition } from "@/lib/types";
import HomePageClient from "@/components/home-page-client";
import { Button } from "@/components/ui/button";

export const revalidate = 0; // This will disable caching for this page

// Server-side fetch
async function getPublishedEditions() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);
  
  // Query for the most recent published editions
  const q = query(
    collection(firestore, "newspaper_editions"), 
    orderBy("publicationDate", "desc"), 
    limit(20) // Fetch last 20 editions
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return [];
  }
  
  // Filter for published editions only
  const publishedEditions = snapshot.docs
    .filter(doc => doc.data().isPublished === true)
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Edition));

  return publishedEditions;
}


export default async function HomePage() {
  const editions = await getPublishedEditions();
  const latestEdition = editions.length > 0 ? editions[0] : null;

  return (
    <>
      <header className="py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <Newspaper className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold font-headline">The Daily Agent</h1>
            </div>
            <Link href="/admin" className="text-sm text-primary hover:underline">
                Admin Panel
            </Link>
        </div>
      </header>
      <main className="container mx-auto py-8 md:py-12">
        
        {latestEdition ? (
          <HomePageClient editions={editions} />
        ) : (
          <div className="text-center py-24">
            <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-tight">Today's Edition</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                The presses are quiet. The first automated edition will be published tomorrow at 6 AM IST.
            </p>
            <Button asChild className="mt-8">
                <Link href="/admin">Go to Admin Panel</Link>
            </Button>
          </div>
        )}
      </main>
      <footer className="py-6 border-t mt-12">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} The Daily Agent. Powered by AI.</p>
          </div>
      </footer>
    </>
  );
}
