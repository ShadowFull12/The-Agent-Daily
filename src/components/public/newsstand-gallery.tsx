
"use client";

import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { Edition } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function EditionCard({ edition }: { edition: Edition }) {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleFullscreen = () => {
        const newWindow = window.open('', '_blank', 'width=1400,height=900');
        if (newWindow) {
            newWindow.document.write(edition.htmlContent);
            newWindow.document.close();
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="font-headline">Edition #{edition.editionNumber}</DialogTitle>
                            <DialogDescription>{edition.headline}</DialogDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFullscreen}
                            title="Open in fullscreen window"
                        >
                            <Maximize2 className="h-4 w-4 mr-2" />
                            Fullscreen
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-auto border rounded-md bg-gray-50">
                   <iframe 
                      srcDoc={edition.htmlContent} 
                      className="w-full h-full"
                      title={`Edition #${edition.editionNumber}`}
                      style={{ minHeight: '100%' }}
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
