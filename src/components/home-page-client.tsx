"use client";

import { useState } from "react";
import { Edition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Calendar } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";

interface HomePageClientProps {
  editions: Edition[];
}

export default function HomePageClient({ editions }: HomePageClientProps) {
  const [selectedEdition, setSelectedEdition] = useState<Edition>(editions[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleFullscreen = () => {
    if (!selectedEdition) return;
    const newWindow = window.open('', '_blank', 'width=1400,height=900');
    if (newWindow) {
      newWindow.document.write(selectedEdition.htmlContent);
      newWindow.document.close();
    }
  };

  const formatEditionDate = (edition: Edition) => {
    try {
      if (!edition.publicationDate) return 'Unknown date';
      
      // Handle Firestore Timestamp
      if (typeof edition.publicationDate === 'object' && 'toDate' in edition.publicationDate) {
        return format(edition.publicationDate.toDate(), 'MMMM d, yyyy');
      }
      
      // Handle seconds/nanoseconds object
      if (typeof edition.publicationDate === 'object' && 'seconds' in edition.publicationDate) {
        return format(new Date((edition.publicationDate as any).seconds * 1000), 'MMMM d, yyyy');
      }
      
      // Handle regular date
      return format(new Date(edition.publicationDate as any), 'MMMM d, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error, edition.publicationDate);
      return 'Unknown date';
    }
  };

  return (
    <div className="grid gap-12">
      <div className="text-center space-y-4">
        <h2 className="text-sm uppercase text-accent font-semibold tracking-wider">
          Latest Edition: #{selectedEdition.editionNumber}
        </h2>
        <p className="mt-2 text-3xl md:text-5xl font-bold font-headline tracking-tight max-w-4xl mx-auto">
          {selectedEdition.headline}
        </p>
        
        {/* Edition Selector Dropdown */}
        {editions.length > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedEdition.id}
              onValueChange={(editionId) => {
                const edition = editions.find(e => e.id === editionId);
                if (edition) setSelectedEdition(edition);
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select edition" />
              </SelectTrigger>
              <SelectContent>
                {editions.map((edition) => (
                  <SelectItem key={edition.id} value={edition.id}>
                    Edition #{edition.editionNumber} - {formatEditionDate(edition)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <div className="relative group cursor-pointer w-full max-w-4xl mx-auto aspect-video rounded-lg overflow-hidden shadow-2xl">
            <Image 
              src={selectedEdition.coverImageUrl}
              alt={selectedEdition.headline}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Button size="lg">View Full Edition</Button>
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-headline">
                  Edition #{selectedEdition.editionNumber}
                </DialogTitle>
                <DialogDescription>
                  {selectedEdition.headline}
                </DialogDescription>
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
              srcDoc={selectedEdition.htmlContent}
              className="w-full h-full"
              title={`Edition #${selectedEdition.editionNumber}`}
              style={{ minHeight: '100%' }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
