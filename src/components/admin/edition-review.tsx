"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Eye, Trash2, Loader2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Edition {
  id: string;
  editionNumber: number;
  publishedDate: any;
  coverImageUrl: string;
  status: "draft" | "published";
  createdAt: any;
  htmlContent: string;
  headline?: string;
}

interface EditionReviewProps {
  onRefresh?: () => void;
}

export function EditionReview({ onRefresh }: EditionReviewProps) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
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
      const response = await fetch("/api/editions");
      if (response.ok) {
        const data = await response.json();
        setEditions(data.editions || []);
      }
    } catch (error) {
      console.error("Failed to fetch editions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditions();
  }, []);

  const handleDelete = async (editionId: string, editionNumber: number) => {
    setDeleting(editionId);
    try {
      const response = await fetch(`/api/editions/${editionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Edition Deleted",
          description: `Edition #${editionNumber} has been removed.`,
        });
        fetchEditions();
        onRefresh?.();
      } else {
        throw new Error("Failed to delete edition");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the edition. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Edition Review & Management
          </CardTitle>
          <CardDescription>
            Review draft editions and manage published newspapers
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
          Edition Review & Management
        </CardTitle>
        <CardDescription>
          Review draft editions and manage published newspapers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {editions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No editions found. Run the workflow to create one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {editions.map((edition) => (
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
                      {edition.status === "draft" ? "Draft" : "Published"}
                      {edition.publishedDate && ` • ${new Date(edition.publishedDate.seconds * 1000).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={edition.status === "published" ? "default" : "secondary"}>
                    {edition.status}
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
                              {edition.headline || (edition.status === "draft" ? "Draft Edition" : "Published Edition")}
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
                          onClick={() => handleDelete(edition.id, edition.editionNumber)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={fetchEditions} className="w-full">
            Refresh List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
