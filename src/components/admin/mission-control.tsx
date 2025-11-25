"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { publishLatestEditionAction, clearAllDataAction } from "@/app/actions";
import { startWorkflowAction, stopWorkflowAction } from "@/app/actions-workflow";
import { startChainedWorkflow, stopChainedWorkflow } from "@/app/actions-workflow-chained";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WorkflowDiagram, type AgentName, type AgentStatus } from "./workflow-diagram";
import { Play, Timer, CheckCircle, AlertTriangle, Square, RotateCcw, ChevronDown, ChevronUp, Loader2, XCircle, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";
import { Badge } from "@/components/ui/badge";
import { WorkflowChainExecutor } from "@/components/workflow-chain-executor";

const formatCountdown = (ms: number) => {
    if (ms < 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const getNext8PmIst = () => {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);
    const next5Am = new Date(nowIst);
    next5Am.setHours(5, 0, 0, 0);
    if (nowIst.getHours() >= 5) {
        next5Am.setDate(next5Am.getDate() + 1);
    }
    return next5Am;
};

const getNext830PmIst = () => {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);
    const next540Am = new Date(nowIst);
    next540Am.setHours(5, 40, 0, 0);
    if (nowIst.getHours() > 5 || (nowIst.getHours() === 5 && nowIst.getMinutes() >= 40)) {
        next540Am.setDate(next540Am.getDate() + 1);
    }
    return next540Am;
};

type RunStatus = "idle" | "running" | "success" | "error" | "stopping";

interface AgentProgress {
    status: string;
    message: string;
    checked?: number;
    remaining?: number;
    drafted?: number;
}

// Initialize Firebase client
const getFirestoreClient = () => {
    if (getApps().length === 0) {
        const app = initializeApp(firebaseConfig);
        return getFirestore(app);
    }
    return getFirestore();
};

export function MissionControl() {
    const [runStatus, setRunStatus] = useState<RunStatus>("idle");
    const [countdown, setCountdown] = useState("00:00:00");
    const [publishCountdown, setPublishCountdown] = useState("00:00:00");
    const [mounted, setMounted] = useState(false);
    const [expandedAgents, setExpandedAgents] = useState<Set<AgentName>>(new Set());
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
    
    const [agentProgress, setAgentProgress] = useState<Record<string, AgentProgress>>({
        scout: { status: 'idle', message: '' },
        deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
        journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
        journalist_1: { status: 'idle', message: '', drafted: 0 },
        journalist_2: { status: 'idle', message: '', drafted: 0 },
        journalist_3: { status: 'idle', message: '', drafted: 0 },
        journalist_4: { status: 'idle', message: '', drafted: 0 },
        journalist_5: { status: 'idle', message: '', drafted: 0 },
        validator: { status: 'idle', message: '' },
        editor: { status: 'idle', message: '' },
        publisher: { status: 'idle', message: '' }
    });
    
    const [globalMessage, setGlobalMessage] = useState("System is idle. Ready for the next run.");

    const toggleAgentExpanded = (agent: AgentName) => {
        setExpandedAgents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(agent)) {
                newSet.delete(agent);
            } else {
                newSet.add(agent);
            }
            return newSet;
        });
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
        setAgentProgress({
            scout: { status: 'idle', message: '' },
            deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
            journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
            journalist_1: { status: 'idle', message: '', drafted: 0 },
            journalist_2: { status: 'idle', message: '', drafted: 0 },
            journalist_3: { status: 'idle', message: '', drafted: 0 },
            journalist_4: { status: 'idle', message: '', drafted: 0 },
            journalist_5: { status: 'idle', message: '', drafted: 0 },
            validator: { status: 'idle', message: '' },
            editor: { status: 'idle', message: '' },
            publisher: { status: 'idle', message: '' }
        });
        setGlobalMessage("System is idle. Ready for the next run.");
        setRunStatus('idle');
    };

    const handleForceStop = async () => {
        setGlobalMessage("🛑 Stopping workflow - preserving data...");
        setRunStatus('stopping');
        
        const result = await stopChainedWorkflow();
        
        if (result.success) {
            toast({ 
                title: "✅ Workflow Stopped", 
                description: result.message
            });
            resetWorkflow();
        } else {
            toast({ 
                variant: 'destructive', 
                title: "Stop Failed", 
                description: result.message 
            });
        }
    };

    const handleRunWorkflow = async () => {
        if (runStatus === "running") {
            toast({ title: "Workflow in Progress", description: "An automated workflow is already running." });
            return;
        }

        setRunStatus("running");
        setGlobalMessage("Starting chained workflow...");
        
        // Use chained workflow for Vercel Hobby plan compatibility
        const result = await startChainedWorkflow();
        if (result.success) {
            toast({ title: "Chained Workflow Started", description: "Steps will auto-execute. Each completes in <5 min." });
        } else {
            toast({ variant: 'destructive', title: "Failed to Start", description: result.message });
            setRunStatus("idle");
        }
    };

    // Listen to workflow state from Firestore
    useEffect(() => {
        if (!mounted) return;

        try {
            const firestore = getFirestoreClient();
            const workflowDoc = doc(firestore, 'workflow_state', 'current_workflow');
            
            const unsubscribe = onSnapshot(workflowDoc, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setRunStatus(data.status || 'idle');
                    setGlobalMessage(data.message || 'System is idle');
                    
                    if (data.progress) {
                        const newStatuses: Record<AgentName, AgentStatus> = {
                            scout: data.progress.scout?.status as AgentStatus || 'idle',
                            deduplicator: data.progress.deduplicator?.status as AgentStatus || 'idle',
                            journalist: data.progress.journalist?.status as AgentStatus || 'idle',
                            validator: data.progress.validator?.status as AgentStatus || 'idle',
                            editor: data.progress.editor?.status as AgentStatus || 'idle',
                            publisher: data.progress.publisher?.status as AgentStatus || 'idle',
                        };
                        setAgentStatuses(newStatuses);
                        
                        setAgentProgress({
                            scout: data.progress.scout || { status: 'idle', message: '' },
                            deduplicator: data.progress.deduplicator || { status: 'idle', message: '', checked: 0, remaining: 0 },
                            journalist: data.progress.journalist || { status: 'idle', message: '', drafted: 0, remaining: 0 },
                            journalist_1: data.progress.journalist_1 || { status: 'idle', message: '', drafted: 0 },
                            journalist_2: data.progress.journalist_2 || { status: 'idle', message: '', drafted: 0 },
                            journalist_3: data.progress.journalist_3 || { status: 'idle', message: '', drafted: 0 },
                            journalist_4: data.progress.journalist_4 || { status: 'idle', message: '', drafted: 0 },
                            journalist_5: data.progress.journalist_5 || { status: 'idle', message: '', drafted: 0 },
                            validator: data.progress.validator || { status: 'idle', message: '' },
                            editor: data.progress.editor || { status: 'idle', message: '' },
                            publisher: data.progress.publisher || { status: 'idle', message: '' },
                        });
                    } else if (data.status === 'idle') {
                        // If state is idle but progress is missing, reset it fully
                        resetWorkflow();
                    }

                } else {
                    // Document doesn't exist, so we are idle
                    resetWorkflow();
                }
            }, (error) => {
                console.error('Error listening to workflow state:', error);
                resetWorkflow();
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Failed to setup Firestore listener:', error);
        }
    }, [mounted]);

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Timer for the next automated run
    useEffect(() => {
        if (!mounted) return;
        
        const timerId = setInterval(() => {
            const next5Am = getNext8PmIst(); // Function name kept for compatibility but returns 5:00 AM
            const now = new Date();
            const diff = next5Am.getTime() - now.getTime();
            setCountdown(formatCountdown(diff));
            
            // Note: Auto-trigger now handled by Vercel Cron at 5:00 AM IST
            // No client-side trigger needed for automated runs
        }, 1000);

        return () => clearInterval(timerId);
    }, [mounted, runStatus, toast]);

    // Timer for the next publication
    useEffect(() => {
        if (!mounted) return;
        
        const timerId = setInterval(() => {
            const next540Am = getNext830PmIst(); // Function name kept for compatibility but returns 5:40 AM
            const now = new Date();
            const diff = next540Am.getTime() - now.getTime();
            setPublishCountdown(formatCountdown(diff));
            
            // Note: Auto-publish now handled by Vercel Cron at 5:40 AM IST
            // No client-side trigger needed for automated publish
        }, 1000);

        return () => clearInterval(timerId);
    }, [toast, router, mounted]);

    return (
        <>
            {/* Client executor for manual runs - instant execution */}
            <WorkflowChainExecutor />
            
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                   <div className="space-y-1.5 flex-1">
                     <CardTitle>Automated Workflow (Hybrid)</CardTitle>
                     <CardDescription>
                        Manual runs: Instant execution via client. Auto runs: 5:00 AM IST daily via Cron-Job.org. Publishes at 5:40 AM IST. Each step = separate function call (&lt;300s). 25 leads, 20+ articles target.
                     </CardDescription>
                   </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Auto Run (5:00 AM IST)</p>
                    <p className="text-2xl font-bold font-mono text-primary">
                      {mounted ? countdown : "00:00:00"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Auto Publish (5:40 AM IST)</p>
                    <p className="text-2xl font-bold font-mono text-green-600">
                      {mounted ? publishCountdown : "00:00:00"}
                    </p>
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

                    {/* Detailed Agent Progress */}
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Agent Details</p>
                        {(['scout', 'deduplicator', 'journalist', 'validator', 'editor', 'publisher'] as AgentName[]).map((agent) => {
                            const progress = agentProgress[agent];
                            const isExpanded = expandedAgents.has(agent);
                            const hasDetails = progress.message || progress.checked !== undefined || progress.drafted !== undefined;
                            
                            return (
                                <div key={agent} className="border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => hasDetails && toggleAgentExpanded(agent)}
                                        className={`w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${!hasDetails ? 'cursor-default' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {progress.status === 'idle' && <Clock className="h-4 w-4 text-gray-400" />}
                                            {progress.status === 'working' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                                            {progress.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            {progress.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                                            {progress.status === 'cooldown' && <Timer className="h-4 w-4 text-gray-400" />}
                                            
                                            <span className="font-medium capitalize">{agent}</span>
                                            
                                            <Badge variant={
                                                progress.status === 'success' ? 'default' :
                                                progress.status === 'working' ? 'secondary' :
                                                progress.status === 'error' ? 'destructive' :
                                                'outline'
                                            }>
                                                {progress.status}
                                            </Badge>
                                            
                                            {agent === 'deduplicator' && (progress.checked !== undefined || progress.status === 'working') && (
                                                <span className="text-xs text-muted-foreground">
                                                    {progress.checked || 0} checked, {progress.remaining || 0} remaining
                                                </span>
                                            )}
                                            
                                            {agent === 'journalist' && (progress.drafted !== undefined || progress.status === 'working') && (
                                                <span className="text-xs text-muted-foreground font-semibold">
                                                    Total: {progress.drafted || 0} drafted
                                                </span>
                                            )}
                                        </div>
                                        
                                        {hasDetails && (
                                            isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                        )}
                                    </button>
                                    
                                    {isExpanded && hasDetails && (
                                        <div className="px-4 pb-3 pt-1 bg-gray-50/50 dark:bg-gray-900/50 border-t">
                                            <p className="text-sm text-muted-foreground">{progress.message || 'No message'}</p>
                                            {agent === 'deduplicator' && (
                                                <div className="mt-2 flex gap-4 text-xs">
                                                    <span>Checked: <strong>{progress.checked || 0}</strong></span>
                                                    <span>Remaining: <strong>{progress.remaining || 0}</strong></span>
                                                </div>
                                            )}
                                            {agent === 'journalist' && (
                                                <div className="mt-3 space-y-2">
                                                    <div className="text-xs font-medium text-muted-foreground mb-1">Individual Journalists:</div>
                                                    {[1, 2, 3, 4, 5].map((num) => {
                                                        const journalistKey = `journalist_${num}` as any;
                                                        const journalistProgress = agentProgress[journalistKey] || { status: 'idle', message: '', drafted: 0 };
                                                        return (
                                                            <div key={num} className="flex items-center justify-between py-1.5 px-2 bg-white dark:bg-gray-800 rounded border">
                                                                <div className="flex items-center gap-2">
                                                                    {journalistProgress.status === 'idle' && <Clock className="h-3 w-3 text-gray-400" />}
                                                                    {journalistProgress.status === 'working' && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                                                                    {journalistProgress.status === 'success' && <CheckCircle className="h-3 w-3 text-green-500" />}
                                                                    <span className="text-xs font-medium">Journalist {num}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs text-muted-foreground">{journalistProgress.message}</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {journalistProgress.drafted || 0} articles
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="mt-2 pt-2 border-t">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="font-medium">Total Drafted:</span>
                                                            <span className="font-bold">{progress.drafted || 0} articles</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Controls */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-center gap-2 flex-wrap">
                    <Button onClick={handleRunWorkflow} disabled={runStatus === 'running' || runStatus === 'stopping'}>
                        <Play className="mr-2 h-4 w-4" />
                        Force Full Run
                    </Button>

                    {(runStatus === 'running' || runStatus === 'stopping') && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    <Square className="mr-2 h-4 w-4" />
                                    Force Stop Workflow
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Stop Workflow?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will immediately stop the workflow. All data (leads and drafts) will be preserved.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={handleForceStop}
                                    >
                                        Stop Workflow
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
        </>
    );
}
