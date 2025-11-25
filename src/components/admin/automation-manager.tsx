
"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { findLeadsAction, draftSingleArticleAction, createPreviewEditionAction, publishLatestEditionAction } from "@/app/actions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { query, collection } from "firebase/firestore";
import type { RawLead } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Timer, Zap, PenSquare, UploadCloud, CheckCircle } from 'lucide-react';
import { useRouter } from "next/navigation";

// --- Time Helper Functions ---
const getNext5AmIst = () => {
    // IST is UTC+5:30
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);

    const next5AmIst = new Date(nowIst);
    next5AmIst.setHours(5, 0, 0, 0);

    if (nowIst.getHours() >= 6) { // If it's past 6 AM IST, schedule for the next day
        next5AmIst.setDate(next5AmIst.getDate() + 1);
    }
    
    return next5AmIst;
};

const getNext6AmIst = () => {
    const next5 = getNext5AmIst();
    const next6 = new Date(next5);
    next6.setHours(6, 0, 0, 0);
    // If the 5am run is for tomorrow, 6am should also be for tomorrow
    if(next5.getDate() > new Date().getDate() || (next5.getDate() === 1 && new Date().getDate() > 1)){
         // it's for the next day
    }
    return next6;
};


const formatCountdown = (ms: number) => {
    if (ms < 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};


type AutomationStatus = "Idle" | "Finding Leads" | "Drafting Articles" | "Creating Preview" | "Awaiting Publication" | "Publishing";

export function AutomationManager() {
  const [countdown, setCountdown] = useState("");
  const [status, setStatus] = useState<AutomationStatus>("Idle");
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();

  const rawLeadsQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "raw_leads")) : null,
    [firestore]
  );
  const { data: rawLeads } = useCollection<RawLead>(rawLeadsQuery);

  const runFullCycle = useCallback(async () => {
    try {
        // 1. Find Leads
        setStatus("Finding Leads");
        toast({ title: "Automation: Finding Leads", description: "Scout agent is searching for news." });
        await findLeadsAction();
        router.refresh();

        // 2. Wait 2 minutes then draft articles
        setStatus("Drafting Articles");
        toast({ title: "Automation: Drafting Starting Soon", description: "Journalist will begin drafting in 2 minutes." });
        await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

        let leadsAvailable = true;
        while(leadsAvailable) {
            const result = await draftSingleArticleAction();
            router.refresh();
            if (!result.success || (result.message && !result.message.startsWith("Successfully"))) {
                leadsAvailable = false; // Stop if no more leads or an error occurred
            }
             await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s between drafts
        }
        
        toast({ title: "Automation: Drafting Complete", description: "All leads have been processed." });

        // 3. Create Preview Edition
        setStatus("Creating Preview");
        toast({ title: "Automation: Creating Preview", description: "Editor is creating the edition for review." });
        const previewResult = await createPreviewEditionAction();
        if (!previewResult.success) throw new Error(previewResult.error || "Failed to create preview.");
        router.refresh();

        // 4. Wait for 6 AM to publish
        setStatus("Awaiting Publication");
        const next6Am = getNext6AmIst();
        toast({ title: "Automation: Awaiting Publication", description: `Edition created. Will be published at ${next6Am.toLocaleTimeString('en-US')}` });

        const timeTo6Am = next6Am.getTime() - new Date().getTime();
        if (timeTo6Am > 0) {
            await new Promise(resolve => setTimeout(resolve, timeTo6Am));
        }

        // 5. Publish
        setStatus("Publishing");
        toast({ title: "Automation: Publishing Edition", description: "Making the latest edition live." });
        await publishLatestEditionAction();
        router.refresh();

        toast({ title: "Automation: Cycle Complete", description: "Today's edition is live!", icon: <CheckCircle className="h-5 w-5 text-green-500" /> });

    } catch (error: any) {
        toast({ variant: 'destructive', title: "Automation Failed", description: error.message });
    } finally {
        setStatus("Idle");
    }
  }, [toast, router]);


  useEffect(() => {
    const timerId = setInterval(() => {
        const next5Am = getNext5AmIst();
        const now = new Date();
        const diff = next5Am.getTime() - now.getTime();
        setCountdown(formatCountdown(diff));
        
        // Trigger the cycle if we are very close to 5 AM
        if (diff > 0 && diff < 1000) {
            runFullCycle();
        }

    }, 1000);

    return () => clearInterval(timerId);
  }, [runFullCycle]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Status</CardTitle>
        <CardDescription>The system runs automatically every day. This panel shows the current status and countdown to the next run.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-4 p-4 bg-muted rounded-md">
           <Timer className="h-8 w-8 text-primary" />
           <div>
             <p className="text-sm text-muted-foreground">Next cycle starts in:</p>
             <p className="text-2xl font-bold font-mono">{countdown}</p>
           </div>
        </div>
        <div className="flex items-center space-x-4 p-4 bg-muted rounded-md">
           {status === 'Idle' && <CheckCircle className="h-8 w-8 text-green-500" />}
           {status === 'Finding Leads' && <Zap className="h-8 w-8 text-blue-500 animate-pulse" />}
           {(status === 'Drafting Articles') && <PenSquare className="h-8 w-8 text-orange-500 animate-pulse" />}
           {(status === 'Creating Preview' || status === 'Awaiting Publication' || status === 'Publishing') && <UploadCloud className="h-8 w-8 text-purple-500 animate-pulse" />}
           <div>
             <p className="text-sm text-muted-foreground">Current Status:</p>
             <p className="text-xl font-semibold">{status}</p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
