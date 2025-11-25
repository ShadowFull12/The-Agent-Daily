
import { collection, query, orderBy, limit, getDocs, getFirestore } from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import { Edition } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export const revalidate = 0; // This will disable caching for this page

// Server-side fetch
async function getLatestPublishedEdition() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);
  
  // Query for the most recent editions by date, without filtering by isPublished.
  // This avoids needing a composite index.
  const q = query(
    collection(firestore, "newspaper_editions"), 
    orderBy("publicationDate", "desc"), 
    limit(10) // Fetch a few recent ones to be safe
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }
  
  // Find the first edition in the sorted list that is actually published.
  const latestPublishedDoc = snapshot.docs.find(doc => doc.data().isPublished === true);

  if (!latestPublishedDoc) {
    return null;
  }
  
  return {
    id: latestPublishedDoc.id,
    ...latestPublishedDoc.data(),
  } as Edition;
}


export default async function HomePage() {
  const latestEdition = await getLatestPublishedEdition();

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
          <div className="grid gap-12">
            <div className="text-center">
                <h2 className="text-sm uppercase text-accent font-semibold tracking-wider">Latest Edition: #{latestEdition.editionNumber}</h2>
                <p className="mt-2 text-3xl md:text-5xl font-bold font-headline tracking-tight max-w-4xl mx-auto">{latestEdition.headline}</p>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative group cursor-pointer w-full max-w-4xl mx-auto aspect-video rounded-lg overflow-hidden shadow-2xl">
                    <Image 
                      src={latestEdition.coverImageUrl}
                      alt={latestEdition.headline}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button size="lg">View Full Edition</Button>
                    </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-6xl h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="font-headline">Edition #{latestEdition.editionNumber}</DialogTitle>

                    <DialogDescription>{latestEdition.headline}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto border rounded-md">
                   <iframe 
                      srcDoc={latestEdition.htmlContent} 
                      className="w-full h-full"
                      title={`Edition #${latestEdition.editionNumber}`}
                   />
                </div>
              </DialogContent>
            </Dialog>

          </div>
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
