"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, Eye, Trash2, Loader2, Maximize2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteEditionAction, publishLatestEditionAction } from "@/app/actions";

interface Edition {
  id: string;
  editionNumber: number;
  publishedDate: any;
  publicationDate: any;
  coverImageUrl: string;
  isPublished: boolean;
  createdAt: any;
  htmlContent: string;
  headline?: string;
}

interface EditionsManagerProps {
  onRefresh?: () => void;
}

export function EditionsManager({ onRefresh }: EditionsManagerProps) {
  const [draftEditions, setDraftEditions] = useState<Edition[]>([]);
  const [publishedEditions, setPublishedEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [viewingEdition, setViewingEdition] = useState<Edition | null>(null);
  const { toast } = useToast();

  const handleFullscreen = () => {
    if (!viewingEdition) return;
    const newWindow = window.open('', '_blank', 'width=1400,height=900');
    if (newWindow) {
      newWindow.document.write(viewingEdition.htmlContent);
      newWindow.document.close();
    }
  };

  const fetchEditions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/editions/all", {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        const editions = data.editions || [];
        
        // Split into drafts and published
        setDraftEditions(editions.filter((e: Edition) => !e.isPublished));
        setPublishedEditions(editions.filter((e: Edition) => e.isPublished));
      } else {
        toast({
          title: "Error Loading Editions",
          description: "Failed to load editions",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch editions:", error);
      toast({
        title: "Network Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditions();
  }, []);

  const handleDelete = async (editionId: string, editionNumber: number, isDraft: boolean) => {
    setDeleting(editionId);
    try {
      const result = await deleteEditionAction(editionId);
      
      if (result.success) {
        // Remove from UI immediately
        if (isDraft) {
          setDraftEditions(prev => prev.filter(e => e.id !== editionId));
        } else {
          setPublishedEditions(prev => prev.filter(e => e.id !== editionId));
        }
        
        toast({
          title: "Edition Deleted",
          description: `Edition #${editionNumber} has been removed.`,
        });
        
        setTimeout(() => fetchEditions(), 500);
        onRefresh?.();
      } else {
        throw new Error(result.error || "Failed to delete edition");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete the edition",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handlePublish = async (editionId: string, editionNumber: number) => {
    setPublishing(editionId);
    try {
      const result = await publishLatestEditionAction();
      
      if (result.success) {
        toast({
          title: "Edition Published",
          description: `Edition #${editionNumber} is now public`,
        });
        
        // Refresh to move from drafts to published
        await fetchEditions();
        onRefresh?.();
      } else {
        throw new Error(result.error || "Failed to publish edition");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to publish the edition",
        variant: "destructive",
      });
    } finally {
      setPublishing(null);
    }
  };

  const renderEditionCard = (edition: Edition, isDraft: boolean) => (
    <div
      key={edition.id}
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-16 bg-muted rounded overflow-hidden">
          {edition.coverImageUrl ? (
            <img
              src={edition.coverImageUrl}
              alt={`Edition ${edition.editionNumber}`}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Newspaper className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <h3 className="font-semibold">
            Edition #{edition.editionNumber}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isDraft ? "Draft" : "Published"}
            {(edition.publishedDate || edition.publicationDate) && 
              ` • ${new Date((edition.publishedDate || edition.publicationDate).seconds * 1000).toLocaleDateString()}`}
          </p>
        </div>
        <Badge variant={isDraft ? "secondary" : "default"}>
          {isDraft ? "draft" : "published"}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Dialog onOpenChange={(open) => setViewingEdition(open ? edition : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="font-headline">
                    Edition #{edition.editionNumber}
                  </DialogTitle>
                  <DialogDescription>
                    {edition.headline || (isDraft ? "Draft Edition" : "Published Edition")}
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
                srcDoc={edition.htmlContent}
                className="w-full h-full"
                title={`Edition #${edition.editionNumber}`}
                style={{ minHeight: '100%' }}
              />
            </div>
          </DialogContent>
        </Dialog>
        
        {isDraft && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={publishing === edition.id}
              >
                {publishing === edition.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publish
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish Edition #{edition.editionNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will make the edition public and move it to the Published section.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handlePublish(edition.id, edition.editionNumber)}
                >
                  Publish
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={deleting === edition.id}
            >
              {deleting === edition.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Edition #{edition.editionNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the edition.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(edition.id, edition.editionNumber, isDraft)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Edition Management
          </CardTitle>
          <CardDescription>
            Manage draft and published editions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Edition Management
        </CardTitle>
        <CardDescription>
          Review drafts, publish editions, and manage published newspapers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="drafts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drafts">
              In Review <Badge variant="secondary" className="ml-2">{draftEditions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="published">
              Published <Badge variant="default" className="ml-2">{publishedEditions.length}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="drafts" className="mt-4">
            {draftEditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No draft editions. Run the workflow to create one.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {draftEditions.map((edition) => renderEditionCard(edition, true))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="published" className="mt-4">
            {publishedEditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No published editions yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {publishedEditions.map((edition) => renderEditionCard(edition, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="mt-4">
          <Button variant="outline" onClick={fetchEditions} className="w-full">
            Refresh List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
