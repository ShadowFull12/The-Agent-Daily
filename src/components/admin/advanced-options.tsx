
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { RawLead, DraftArticle } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, Database, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearRawLeadsAction, clearDraftArticlesAction, deleteRawLeadAction, deleteDraftArticleAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "../ui/skeleton";
import { useState } from "react";


function DataDisplay<T extends { id: string; title?: string; headline?: string; createdAt: any }>({
    collectionName,
    data,
    isLoading,
    onDelete,
    onDeleteAll
}: {
    collectionName: string;
    data: T[] | null;
    isLoading: boolean;
    onDelete: (id: string) => void;
    onDeleteAll: () => void;
}) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (!data || data.length === 0) {
        return <p className="text-center text-sm text-muted-foreground py-8">No {collectionName} found.</p>;
    }

    return (
        <div className="space-y-4">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={data.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete All {collectionName}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all {data.length} {collectionName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDeleteAll}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <ScrollArea className="h-72 pr-4">
                <div className="space-y-2">
                    {data.map((item) => (
                        <Card key={item.id} className="flex items-center justify-between p-3">
                            <div>
                                <p className="font-semibold truncate pr-4">{item.title || item.headline}</p>
                                <p className="text-xs text-muted-foreground">
                                    Created {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive flex-shrink-0">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the item. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(item.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

export function AdvancedOptions() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<any>(null);

    const rawLeadsQuery = useMemoFirebase(() => query(collection(firestore, "raw_leads"), orderBy("createdAt", "desc")), [firestore]);
    const draftArticlesQuery = useMemoFirebase(() => query(collection(firestore, "draft_articles"), orderBy("createdAt", "desc")), [firestore]);

    const { data: rawLeads, isLoading: leadsLoading } = useCollection<RawLead>(rawLeadsQuery);
    const { data: draftArticles, isLoading: articlesLoading } = useCollection<DraftArticle>(draftArticlesQuery);
    
    const handleAction = async (action: () => Promise<{success: boolean, error?: string, count?: number}>, successMessage: string) => {
        const { success, error, count } = await action();
        if (success) {
            toast({
                title: "Success",
                description: `${count ? `${count} items deleted. ` : ''}${successMessage}`,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Action Failed",
                description: error,
            });
        }
    };
    
    const handleDeleteLead = (id: string) => handleAction(() => deleteRawLeadAction(id), "Lead deleted.");
    const handleDeleteAllLeads = () => handleAction(clearRawLeadsAction, "All raw leads cleared.");
    
    const handleDeleteArticle = (id: string) => handleAction(() => deleteDraftArticleAction(id), "Article deleted.");
    const handleDeleteAllArticles = () => handleAction(clearDraftArticlesAction, "All draft articles cleared.");

    const handleCleanup = async () => {
        setCleanupLoading(true);
        setCleanupResult(null);
        try {
            const response = await fetch("/api/editions/cleanup", { method: "POST" });
            const data = await response.json();
            if (response.ok) {
                setCleanupResult(data);
                toast({
                    title: "Cleanup Complete",
                    description: `Removed ${data.deleted} duplicate editions`,
                });
            } else {
                throw new Error(data.error || "Cleanup failed");
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setCleanupLoading(false);
        }
    };

    return (
        <Accordion type="single" collapsible>
            <AccordionItem value="advanced-options">
                <AccordionTrigger>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-lg font-semibold">Advanced Options</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Card className="mt-2">
                        <CardHeader>
                            <CardTitle>Content Pipeline</CardTitle>
                            <CardDescription>
                                Manually inspect and manage the raw leads and drafted articles in the system. Use with caution.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Tabs defaultValue="raw_leads">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="raw_leads">
                                        Raw Leads <Badge variant="secondary" className="ml-2">{rawLeads?.length || 0}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="draft_articles">
                                        Draft Articles <Badge variant="secondary" className="ml-2">{draftArticles?.length || 0}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="cleanup">
                                        <Database className="h-4 w-4 mr-1" />
                                        Cleanup
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="raw_leads" className="pt-4">
                                   <DataDisplay
                                     collectionName="Raw Leads"
                                     data={rawLeads}
                                     isLoading={leadsLoading}
                                     onDelete={handleDeleteLead}
                                     onDeleteAll={handleDeleteAllLeads}
                                   />
                                </TabsContent>
                                <TabsContent value="draft_articles" className="pt-4">
                                     <DataDisplay
                                      collectionName="Draft Articles"
                                      data={draftArticles}
                                      isLoading={articlesLoading}
                                      onDelete={handleDeleteArticle}
                                      onDeleteAll={handleDeleteAllArticles}
                                    />
                                </TabsContent>
                                <TabsContent value="cleanup" className="pt-4">
                                    <div className="space-y-4">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <p className="text-sm text-yellow-800">
                                                <strong>Database Cleanup:</strong> Removes duplicate editions (keeps newest of each edition number) and ensures data consistency.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleCleanup}
                                            disabled={cleanupLoading}
                                            className="w-full"
                                            size="lg"
                                        >
                                            {cleanupLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Running Cleanup...
                                                </>
                                            ) : (
                                                <>
                                                    <Database className="mr-2 h-5 w-5" />
                                                    Run Database Cleanup
                                                </>
                                            )}
                                        </Button>
                                        {cleanupResult && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                <div className="text-sm text-green-800 space-y-1">
                                                    <p className="font-semibold">Cleanup Results:</p>
                                                    <ul className="space-y-1 ml-4">
                                                        <li>✅ Deleted: <strong>{cleanupResult.deleted}</strong> duplicates</li>
                                                        <li>📊 Remaining Drafts: <strong>{cleanupResult.remainingDrafts}</strong></li>
                                                        <li>📰 Unique Editions: <strong>{cleanupResult.uniqueEditions}</strong></li>
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
