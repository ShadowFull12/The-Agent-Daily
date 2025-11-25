
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { findLeadsAction, draftSingleArticleAction, createPreviewEditionAction, publishLatestEditionAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, Zap, PenSquare, StopCircle } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { query, collection } from "firebase/firestore";
import type { RawLead } from "@/lib/types";

type AgentName = 'scout' | 'journalist' | 'publisher';
type WorkingState = AgentName | 'idle';

export function ManualControls() {
  const [workingState, setWorkingState] = useState<WorkingState>('idle');
  const [isDrafting, setIsDrafting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();

  const rawLeadsQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "raw_leads")) : null,
    [firestore]
  );
  const { data: rawLeads, isLoading: leadsLoading } = useCollection<RawLead>(rawLeadsQuery);

  const isAnyAgentWorking = workingState !== 'idle' || isDrafting;

  const handleFindLeads = async () => {
    setWorkingState('scout');
    toast({
        title: "Scout Agent Dispatched",
        description: "Searching for new breaking news...",
    });
    try {
      const result = await findLeadsAction();
      toast({
        title: "Scout Run Complete",
        description: result.message,
      });
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Scout Run Failed",
        description: error.message,
      });
    } finally {
        setWorkingState('idle');
    }
  };

  const handleCreatePreview = async () => {
      setWorkingState('publisher');
      toast({
        title: "Editor Dispatched",
        description: "Creating preview edition from latest drafts...",
      });
      try {
          const result = await createPreviewEditionAction();
          if (result.success) {
            toast({
                title: "Preview Created",
                description: "The new edition is available for review. Drafts have been cleared.",
            });
            router.refresh();
          } else {
            throw new Error(result.error || "An unknown server error occurred during preview creation.");
          }
      } catch (error: any) {
          console.error(error);
          toast({
            variant: "destructive",
            title: "Preview Creation Failed",
            description: error.message,
          });
      } finally {
        setWorkingState('idle');
      }
  };
  
    const handlePublish = async () => {
      setWorkingState('publisher');
      toast({
        title: "Publication Command Sent",
        description: "Publishing the latest reviewed edition...",
      });
      try {
          const result = await publishLatestEditionAction();
          if (result.success) {
            toast({
                title: "Publication Successful",
                description: "The latest edition is now live.",
            });
            router.refresh();
          } else {
            throw new Error(result.error || "An unknown server error occurred during publishing.");
          }
      } catch (error: any) {
          console.error(error);
          toast({
            variant: "destructive",
            title: "Publication Failed",
            description: error.message,
          });
      } finally {
        setWorkingState('idle');
      }
  };

  const handleStartDrafting = () => {
    if (!rawLeads || rawLeads.length === 0) {
      toast({
        title: "Journalist Agent Idle",
        description: "No raw leads available to draft articles from.",
      });
      return;
    }
    toast({
      title: "Journalist Agent Activated",
      description: "Starting to draft articles from all available leads...",
    });
    setIsDrafting(true);
  };

  const handleStopDrafting = useCallback(() => {
    setIsDrafting(false);
    toast({
      title: "Journalist Agent Halted",
      description: "The drafting process has been stopped.",
    });
  }, [toast]);

  const draftNextArticle = useCallback(async () => {
    try {
      const result = await draftSingleArticleAction();
      if (result.success) {
        if (result.message && result.message.startsWith("Successfully")) {
          toast({
            title: "Article Drafted",
            description: result.message,
          });
          router.refresh(); // Refresh data on the page
        } else {
          // This means "No more raw leads to process."
          toast({
              title: "Journalist Run Complete",
              description: "All available leads have been processed.",
          });
          setIsDrafting(false);
        }
      } else {
        // If there's an error (not a "no more leads" message), show it
        if (result.error) {
           toast({ variant: "destructive", title: "Drafting Error", description: result.error });
        }
        // In any case of non-success, stop drafting. This handles completion or errors.
        handleStopDrafting();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Drafting Failed", description: error.message });
      handleStopDrafting();
    }
  }, [toast, router, handleStopDrafting]);

  useEffect(() => {
    if (isDrafting) {
      if (!rawLeads || rawLeads.length === 0) {
        setIsDrafting(false); // Stop if we started with no leads somehow
        return;
      }
      
      const timer = setTimeout(() => {
        draftNextArticle();
      }, 2000); // 2-second delay between each draft

      return () => clearTimeout(timer);
    }
  }, [isDrafting, rawLeads, draftNextArticle]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Controls</CardTitle>
        <CardDescription>Manually trigger the AI agent workflows. The journalist agent processes leads continuously until stopped or finished. Note: Automation is active.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button onClick={handleFindLeads} disabled={isAnyAgentWorking}>
            <Zap className="mr-2 h-4 w-4" />
            {workingState === 'scout' ? 'Searching...' : '1. Find Leads'}
        </Button>
        
        {!isDrafting ? (
          <Button onClick={handleStartDrafting} disabled={isAnyAgentWorking || leadsLoading}>
              <PenSquare className="mr-2 h-4 w-4" />
              {leadsLoading ? 'Loading...' : '2. Draft All'}
          </Button>
        ) : (
          <Button onClick={handleStopDrafting} variant="destructive">
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Drafting
          </Button>
        )}

        <Button onClick={handleCreatePreview} disabled={isAnyAgentWorking}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {workingState === 'publisher' ? 'Creating...' : '3. Create Preview'}
        </Button>
        <Button onClick={handlePublish} disabled={isAnyAgentWorking}>
            <UploadCloud className="mr-2 h-4 w-4 text-green-500" />
            {workingState === 'publisher' ? 'Publishing...' : '4. Publish Live'}
        </Button>
      </CardContent>
    </Card>
  );
}
