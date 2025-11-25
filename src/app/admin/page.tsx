
"use client";

import { useState } from "react";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, where } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { ManualControls } from "@/components/admin/manual-controls";
import { AutomationManager } from "@/components/admin/automation-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RawLead, DraftArticle, Edition } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Eye, EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteMultipleItemsAction } from "@/app/actions";
import { useRouter } from "next/navigation";

function BulkDeleteButton({ collectionName, selectedIds, onClearSelection }: { collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions', selectedIds: string[], onClearSelection: () => void }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    if (selectedIds.length === 0) {
        return null;
    }

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteMultipleItemsAction(collectionName, selectedIds);
            if(result.success) {
                toast({ title: "Success", description: `${selectedIds.length} item(s) deleted.`});
                onClearSelection();
                router.refresh(); 
            } else {
                throw new Error(result.error || "Unknown error occurred.");
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {selectedIds.length} Selected
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the {selectedIds.length} selected item(s).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function EditionPreview({ edition, children }: { edition: Edition, children: React.ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-6xl h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="font-headline">Preview: Edition #{edition.editionNumber}</DialogTitle>
                    <DialogDescription>{edition.headline}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto border rounded-md">
                   <iframe 
                      srcDoc={edition.htmlContent} 
                      className="w-full h-full"
                      title={`Preview: Edition #${edition.editionNumber}`}
                   />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DataColumn<T extends { id: string; createdAt?: any; publicationDate?: any; [key: string]: any }>({ 
    title, 
    description, 
    data, 
    isLoading, 
    renderItem, 
    collectionName,
    selectedIds,
    onSelectionChange,
    onClearSelection
}: { 
    title: string, 
    description: string, 
    data: T[] | null, 
    isLoading: boolean, 
    renderItem: (item: T, isSelected: boolean) => React.ReactNode, 
    collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions',
    selectedIds: string[],
    onSelectionChange: (docId: string, isSelected: boolean) => void,
    onClearSelection: () => void
}) {
  
  const renderContent = (item: T) => {
    const isSelected = selectedIds.includes(item.id);
    const content = (
      <div 
        key={item.id} 
        className="relative p-3 pl-12 border rounded-md bg-card cursor-pointer hover:bg-muted/80 transition-colors data-[state=checked]:bg-accent/20 data-[state=checked]:border-accent"
        data-state={isSelected ? 'checked' : 'unchecked'}
        onClick={(e) => {
          // Stop propagation if the click is on the checkbox itself to avoid double toggling
          if ((e.target as HTMLElement).closest('.checkbox-wrapper')) return;
          if (collectionName !== 'newspaper_editions') {
            onSelectionChange(item.id, !isSelected)
          }
        }}
      >
         <div className="checkbox-wrapper absolute top-1/2 -translate-y-1/2 left-3 h-5 w-5">
           <Checkbox
              id={`select-${item.id}`}
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange(item.id, !!checked)}
           />
         </div>
         <div className="min-w-0 pr-8">
            {renderItem(item, isSelected)}
         </div>
      </div>
    );

    if (collectionName === 'newspaper_editions') {
      return (
        <EditionPreview key={item.id} edition={item as Edition}>
          {content}
        </EditionPreview>
      );
    }
    
    return content;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-96 pr-4">
          <div className="space-y-4">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            {!isLoading && data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>}
            {data?.map(renderContent)}
          </div>
        </ScrollArea>
      </CardContent>
      {selectedIds.length > 0 && (
         <CardFooter className="p-3 border-t">
            <BulkDeleteButton 
              collectionName={collectionName} 
              selectedIds={selectedIds} 
              onClearSelection={onClearSelection}
            />
         </CardFooter>
      )}
    </Card>
  )
}

export default function AdminDashboard() {
    const firestore = useFirestore();
    const [isWorking, setIsWorking] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Record<'raw_leads' | 'draft_articles' | 'newspaper_editions', string[]>>({
      raw_leads: [],
      draft_articles: [],
      newspaper_editions: []
    });

    const handleSelectionChange = (collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions', docId: string, isSelected: boolean) => {
      setSelectedItems(prev => ({
        ...prev,
        [collectionName]: isSelected
          ? [...prev[collectionName], docId]
          : prev[collectionName].filter(id => id !== docId)
      }));
    };

    const clearSelection = (collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions') => {
      setSelectedItems(prev => ({ ...prev, [collectionName]: [] }));
    };


    const rawLeadsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, "raw_leads"), orderBy("createdAt", "desc")) : null,
        [firestore]
    );
    const { data: rawLeads, isLoading: leadsLoading } = useCollection<RawLead>(rawLeadsQuery);

    const draftArticlesQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, "draft_articles"), orderBy("createdAt", "desc")) : null,
        [firestore]
    );
    const { data: draftArticles, isLoading: draftsLoading } = useCollection<DraftArticle>(draftArticlesQuery);

    const publishedEditionsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, "newspaper_editions"), orderBy("publicationDate", "desc")) : null,
        [firestore]
    );
    const { data: publishedEditions, isLoading: editionsLoading } = useCollection<Edition>(publishedEditionsQuery);


  return (
    <div className="container mx-auto grid gap-8">
        <div className="text-center">
            <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor and control the AI newspaper agents.</p>
        </div>
        <AutomationManager />
        <ManualControls />
        <div className="grid md:grid-cols-3 gap-6">
            <DataColumn<RawLead>
                title="Raw Leads"
                description="Stories found by the Scout agent."
                data={rawLeads}
                isLoading={leadsLoading}
                collectionName="raw_leads"
                selectedIds={selectedItems.raw_leads}
                onSelectionChange={(id, selected) => handleSelectionChange('raw_leads', id, selected)}
                onClearSelection={() => clearSelection('raw_leads')}
                renderItem={(item) => (
                    <>
                        <p className="font-semibold text-sm truncate">{item.title}</p>
                        <div className="flex justify-between items-center mt-1">
                            <Badge variant="secondary">{item.topic}</Badge>
                            <p className="text-xs text-muted-foreground">{item.createdAt ? formatDistanceToNow(item.createdAt.toDate()) : 'just now'} ago</p>
                        </div>
                    </>
                )}
            />
            <DataColumn<DraftArticle>
                title="Draft Articles"
                description="Articles written by the Journalist agent."
                data={draftArticles}
                isLoading={draftsLoading}
                collectionName="draft_articles"
                selectedIds={selectedItems.draft_articles}
                onSelectionChange={(id, selected) => handleSelectionChange('draft_articles', id, selected)}
                onClearSelection={() => clearSelection('draft_articles')}
                renderItem={(item) => (
                    <>
                        <p className="font-semibold text-sm truncate">{item.headline}</p>
                         <p className="text-xs text-muted-foreground mt-1">{item.createdAt ? formatDistanceToNow(item.createdAt.toDate()) : 'just now'} ago</p>
                    </>
                )}
            />
            <DataColumn<Edition>
                title="Published Editions"
                description="Newspapers live on the site."
                data={publishedEditions}
                isLoading={editionsLoading}
                collectionName="newspaper_editions"
                selectedIds={selectedItems.newspaper_editions}
                onSelectionChange={(id, selected) => handleSelectionChange('newspaper_editions', id, selected)}
                onClearSelection={() => clearSelection('newspaper_editions')}
                renderItem={(item) => (
                     <>
                        <p className="font-semibold text-sm truncate">Edition #{item.editionNumber}: {item.headline}</p>
                        <div className="flex justify-between items-center mt-1">
                          <Badge variant={item.isPublished ? "default" : "outline"} className="flex items-center gap-1.5">
                            {item.isPublished ? <Eye className="h-3 w-3"/> : <EyeOff className="h-3 w-3"/>}
                            {item.isPublished ? 'Published' : 'In Review'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{item.publicationDate ? formatDistanceToNow(item.publicationDate.toDate()) : 'just now'} ago</p>
                        </div>
                    </>
                )}
            />
        </div>
    </div>
  );
}
