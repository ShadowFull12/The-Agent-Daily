
"use client";

import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { Edition } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function EditionCard({ edition }: { edition: Edition }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="group cursor-pointer">
                    <div className="aspect-[2/3] relative rounded-lg overflow-hidden border">
                        <Image 
                            src={edition.coverImageUrl}
                            alt={`Cover for Edition #${edition.editionNumber}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-4">
                            <h3 className="text-white font-bold font-headline text-lg">Edition #{edition.editionNumber}</h3>
                        </div>
                    </div>
                    <p className="text-sm font-semibold mt-2 truncate">{edition.headline}</p>
                    <p className="text-xs text-muted-foreground">Published on {new Date(edition.publicationDate.seconds * 1000).toLocaleDateString()}</p>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="font-headline">Edition #{edition.editionNumber}</DialogTitle>
                    <DialogDescription>{edition.headline}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto border rounded-md">
                   <iframe 
                      srcDoc={edition.htmlContent} 
                      className="w-full h-full"
                      title={`Edition #${edition.editionNumber}`}
                   />
                </div>
            </DialogContent>
        </Dialog>
    );
}


export function NewsstandGallery() {
    const firestore = useFirestore();
    const { data: editions, isLoading } = useCollection<Edition>(
        firestore ? query(collection(firestore, "newspaper_editions"), orderBy("publicationDate", "desc")) : null
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
            {isLoading && Array.from({length: 4}).map((_, i) => (
                <div key={i}>
                    <Skeleton className="aspect-[2/3] w-full" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                    <Skeleton className="h-3 w-1/2 mt-1" />
                </div>
            ))}
            {editions?.map(edition => (
                <EditionCard key={edition.id} edition={edition} />
            ))}
        </div>
    );
}
