
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
    findLeadsAction,
    deduplicateLeadsAction,
    draftArticleAction,
    validateArticlesAction,
    createPreviewEditionAction,
    publishLatestEditionAction,
    clearAllDataAction,
    checkExistingDraftsAction
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WorkflowDiagram, type AgentName, type AgentStatus } from "./workflow-diagram";
import { Play, RotateCcw, Rss, FileCheck, PenSquare, CopyCheck, Newspaper, UploadCloud, Timer, CheckCircle, AlertTriangle, Square } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

// --- Time Helper Functions ---
const getNext5AmIst = () => {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);

    // Test mode: 7:40 PM today (19:40)
    const next5AmIst = new Date(nowIst);
    next5AmIst.setHours(19, 40, 0, 0);

    // If already past 7:40 PM, set for tomorrow
    if (nowIst.getHours() > 19 || (nowIst.getHours() === 19 && nowIst.getMinutes() >= 40)) {
        next5AmIst.setDate(next5AmIst.getDate() + 1);
    }
    
    return next5AmIst;
};

const getNext6AmIst = () => {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);

    // Test mode: 8:10 PM today (20:10)
    const next6AmIst = new Date(nowIst);
    next6AmIst.setHours(20, 10, 0, 0);
    
    // If already past 8:10 PM, set for tomorrow
    if(nowIst.getHours() > 20 || (nowIst.getHours() === 20 && nowIst.getMinutes() >= 10)){
        next6AmIst.setDate(next6AmIst.getDate() + 1);
    }

    return next6AmIst;
};


const formatCountdown = (ms: number) => {
    if (ms < 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

type RunStatus = "idle" | "running" | "success" | "error" | "stopping";

export function MissionControl() {
    const [runStatus, setRunStatus] = useState<RunStatus>("idle");
    const [countdown, setCountdown] = useState("");
    const [publishCountdown, setPublishCountdown] = useState("");
    const isStoppingRef = useRef(false);

    const { toast } = useToast();
    const router = useRouter();

    const [agentStatuses, setAgentStatuses] = useState<Record<AgentName, AgentStatus>>({
        scout: 'idle',
        deduplicator: 'idle',
        journalist: 'idle',
        validator: 'idle',
        editor: 'idle',
        publisher: 'idle'
    });
    const [globalMessage, setGlobalMessage] = useState("System is idle. Ready for the next run.");

    const setAgentStatus = (agent: AgentName, status: AgentStatus, message?: string) => {
        setAgentStatuses(prev => ({ ...prev, [agent]: status }));
        if (message) setGlobalMessage(message);
    };
    
    const resetWorkflow = () => {
        setAgentStatuses({
            scout: 'idle',
            deduplicator: 'idle',
            journalist: 'idle',
            validator: 'idle',
            editor: 'idle',
            publisher: 'idle'
        });
        setGlobalMessage("System is idle. Ready for the next run.");
        setRunStatus('idle');
        isStoppingRef.current = false;
    };
    
    const handleForceStop = () => {
        if (runStatus === "running") {
            isStoppingRef.current = true;
            setRunStatus("stopping");
            setGlobalMessage("Workflow termination requested. Finishing current step...");
            toast({ title: "Stopping Workflow", description: "The workflow will stop after the current agent finishes its task." });
        }
    };


    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleRunWorkflow = useCallback(async (isManualRun = false) => {
        if (runStatus === "running") {
            toast({ title: "Workflow in Progress", description: "An automated workflow is already running." });
            return;
        }

        setRunStatus("running");
        resetWorkflow();
        setRunStatus("running"); // resetWorkflow sets it to idle, so set it back
        
        // Always clear all data on workflow start (both manual and automated)
        setGlobalMessage("Clearing previous data for a fresh start...");
        await clearAllDataAction();
        router.refresh();
        await sleep(2000);
        
        if(isManualRun){
            setGlobalMessage("Manual workflow initiated...");
            toast({ title: "Manual Run Started", description: "Starting fresh workflow." });
        } else {
             setGlobalMessage("Automated daily workflow initiated...");
             toast({ title: "Automated Run Started", description: "The daily newspaper generation process has begun." });
        }


        let requiredArticlesMet = false;
        let attempts = 0;

        try {
            while (!requiredArticlesMet && attempts < 3) {
                if (isStoppingRef.current) throw new Error("Workflow manually stopped.");
                attempts++;
                
                // 1. Scout
                setAgentStatus('scout', 'working', `Finding new leads (Attempt ${attempts})...`);
                const leadsResult = await findLeadsAction(25);
                if (isStoppingRef.current) throw new Error("Workflow manually stopped.");
                if (!leadsResult.success) throw new Error(leadsResult.error || "Scout agent failed.");
                setAgentStatus('scout', 'success', `Scout found ${leadsResult.leadCount} new leads.`);
                await sleep(10000);
                setAgentStatus('scout', 'cooldown');

                // 2. Deduplicator (AI-powered, checks one lead at a time)
                if (isStoppingRef.current) throw new Error("Workflow manually stopped.");
                setAgentStatus('deduplicator', 'working', "AI is checking for duplicate stories...");
                let dedupRemaining = -1;
                let totalDeleted = 0;
                let dedupChecks = 0;
                
                do {
                    if (isStoppingRef.current) throw new Error("Workflow manually stopped during deduplication.");
                    const dedupResult = await deduplicateLeadsAction();
                    if (!dedupResult.success && dedupResult.error) {
                        console.warn("Deduplication failed for one lead:", dedupResult.error);
                        break; // Exit loop on error
                    }
                    dedupChecks++;
                    totalDeleted += dedupResult.deletedCount;
                    dedupRemaining = dedupResult.remaining;
                    
                    if (dedupResult.checkedTitle) {
                        const status = dedupResult.deletedCount > 0 ? "duplicate found!" : "unique";
                        setGlobalMessage(`Deduplicator: "${dedupResult.checkedTitle.substring(0, 50)}..." - ${status}. ${dedupRemaining} leads remaining.`);
                    }
                    
                    if (dedupRemaining > 0) {
                        await sleep(1500); // Cooldown between checks
                    }
                } while (dedupRemaining > 1); // Continue until only 1 or 0 leads left
                
                setAgentStatus('deduplicator', 'success', `AI checked ${dedupChecks} leads and removed ${totalDeleted} duplicates.`);
                await sleep(5000);
                setAgentStatus('deduplicator', 'cooldown');

                // 3. Journalist
                if (isStoppingRef.current) throw new Error("Workflow manually stopped.");
                setAgentStatus('journalist', 'working', "Journalist is drafting articles...");
                let remaining = -1;
                let draftsMade = 0;
                do {
                    if (isStoppingRef.current) throw new Error("Workflow manually stopped during drafting.");
                    const draftResult = await draftArticleAction();
                    if (!draftResult.success && draftResult.error) {
                       console.warn("Drafting failed for one article:", draftResult.error);
                    } else if (draftResult.articleId) {
                       draftsMade++;
                       setGlobalMessage(`Journalist drafted ${draftsMade} articles. ${draftResult.remaining} leads left.`);
                    }
                    remaining = draftResult.remaining;
                    if(remaining > 0) {
                        await sleep(2000); // Cooldown between each draft
                    }
                } while (remaining > 0);
                setAgentStatus('journalist', 'success', `Journalist drafted a total of ${draftsMade} articles.`);
                await sleep(5000);
                setAgentStatus('journalist', 'cooldown');

                // 4. Validator
                if (isStoppingRef.current) throw new Error("Workflow manually stopped.");
                setAgentStatus('validator', 'working', "Validating article quality and count...");
                const validationResult = await validateArticlesAction();
                if (!validationResult.success) throw new Error(validationResult.error || "Validation failed.");
                setGlobalMessage(`Validator approved ${validationResult.validCount} articles, discarded ${validationResult.discardedCount}.`);
                
                if (validationResult.validCount >= 15) {
                    requiredArticlesMet = true;
                    setAgentStatus('validator', 'success', `Article count sufficient (${validationResult.validCount}). Proceeding to layout.`);
                } else {
                    setAgentStatus('validator', 'error', `Article count (${validationResult.validCount}) is below 15. Rerunning scout...`);
                    await sleep(5000); // Wait before re-running
                }
            }

            if (isStoppingRef.current) throw new Error("Workflow manually stopped.");

            if (!requiredArticlesMet) {
                throw new Error("Failed to gather enough articles after 3 attempts.");
            }

            // 5. Editor
            setAgentStatus('editor', 'working', "Chief Editor is designing the newspaper layout...");
            const previewResult = await createPreviewEditionAction();
            if (!previewResult.success) throw new Error(previewResult.error || "Edition creation failed.");
            setAgentStatus('editor', 'success', "Newspaper edition created and is ready for review.");
            router.refresh();
            await sleep(5000);
            setAgentStatus('editor', 'cooldown');

            // 6. Publisher
            setAgentStatus('publisher', 'working', "Edition is scheduled. Awaiting 6 AM IST for automatic publication.");
            
            toast({
                title: "Workflow Complete: Ready for Review",
                description: "Today's edition is ready. It will be published automatically at 8:10 PM IST.",
                duration: 10000,
            });
            setRunStatus("success");


        } catch (error: any) {
            console.error("Workflow failed:", error);
            const isStopped = error.message.includes("manually stopped");
            if (isStopped) {
                toast({ variant: 'default', title: "Workflow Stopped", description: "The workflow has been stopped by the user." });
                setGlobalMessage(`Workflow stopped.`);
                setRunStatus("idle");
            } else {
                toast({ variant: 'destructive', title: "Workflow Failed", description: error.message });
                setGlobalMessage(`Workflow failed: ${error.message}`);
                setRunStatus("error");
            }
            // Set all 'working' agents to 'error' status
            setAgentStatuses(prev => {
                const newStatuses = {...prev};
                Object.keys(newStatuses).forEach(key => {
                    const agent = key as AgentName;
                    if (newStatuses[agent] === 'working') {
                        newStatuses[agent] = 'error';
                    }
                });
                return newStatuses;
            });
        } finally {
            isStoppingRef.current = false;
             if (runStatus !== 'error' && runStatus !== 'success') {
                setRunStatus('idle');
             }
        }
    }, [runStatus]);

    // Timer for the next automated run
    useEffect(() => {
        const timerId = setInterval(() => {
            const next5Am = getNext5AmIst();
            const now = new Date();
            const diff = next5Am.getTime() - now.getTime();
            setCountdown(formatCountdown(diff));
            
            // Trigger the cycle if we are very close to 5 AM
            if (diff > 0 && diff < 1000) {
                handleRunWorkflow();
            }

        }, 1000);

        return () => clearInterval(timerId);
    }, [handleRunWorkflow]);

    // Timer for the next publication
    useEffect(() => {
        const timerId = setInterval(() => {
            const next6Am = getNext6AmIst();
            const now = new Date();
            const diff = next6Am.getTime() - now.getTime();
            setPublishCountdown(formatCountdown(diff));
            
            // Trigger the publication if we are very close to 6 AM
            if (diff > 0 && diff < 1000) {
                toast({title: "Publication Time!", description: "Publishing the latest edition."});
                publishLatestEditionAction().then(res => {
                    if(res.success){
                        toast({title: "Published!", description: res.message});
                        router.refresh();
                    } else {
                        toast({variant: 'destructive', title: "Publication Failed", description: res.error});
                    }
                });
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [toast, router]);


    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
               <div className="space-y-1.5 flex-1">
                 <CardTitle>Automated Workflow</CardTitle>
                 <CardDescription>
                    The system runs a full cycle daily at 5 AM IST. You can also trigger it manually.
                 </CardDescription>
               </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Auto Run</p>
                    <p className="text-2xl font-bold font-mono text-primary">{countdown}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Auto Publish</p>
                    <p className="text-2xl font-bold font-mono text-green-600">{publishCountdown}</p>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="bg-gray-50/50 dark:bg-black/20 p-6 rounded-lg border space-y-6">
                    {/* Workflow Diagram */}
                    <WorkflowDiagram agentStatuses={agentStatuses} />

                    {/* Status Display */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">System Status</p>
                        <div className="flex items-center gap-2">
                            {runStatus === "idle" && <CheckCircle className="h-5 w-5 text-gray-400" />}
                            {runStatus === "running" && <Timer className="h-5 w-5 text-blue-500 animate-spin" />}
                            {runStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {runStatus === "error" && <AlertTriangle className="h-5 w-5 text-red-500" />}
                            {runStatus === "stopping" && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                            <p className="text-lg font-semibold">{globalMessage}</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <Button onClick={() => handleRunWorkflow(true)} disabled={runStatus === 'running' || runStatus === 'stopping'}>
                        <Play className="mr-2 h-4 w-4" />
                        Force Full Run
                    </Button>

                    {runStatus === 'running' && (
                        <Button variant="destructive" onClick={handleForceStop}>
                            <Square className="mr-2 h-4 w-4" />
                            Force Stop
                        </Button>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={runStatus === 'running' || runStatus === 'stopping'}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Reset
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle>
                                <AlertDialogDescription>This will clear all leads and drafted articles, allowing for a completely fresh run. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                    await clearAllDataAction();
                                    resetWorkflow();
                                    router.refresh();
                                    toast({title: "System Reset", description: "All leads and drafts have been cleared."})
                                }}>Confirm Reset</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
