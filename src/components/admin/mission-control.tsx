"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { publishLatestEditionAction, clearAllDataAction } from "@/app/actions";
import { startWorkflowAction, stopWorkflowAction } from "@/app/actions-workflow";
import { emergencyKillSwitch } from "@/app/actions-emergency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WorkflowDiagram, type AgentName, type AgentStatus } from "./workflow-diagram";
import { Play, Timer, CheckCircle, AlertTriangle, Square, RotateCcw, Skull } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";

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
    const next8Pm = new Date(nowIst);
    next8Pm.setHours(20, 0, 0, 0);
    if (nowIst.getHours() > 20 || (nowIst.getHours() === 20 && nowIst.getMinutes() >= 0)) {
        next8Pm.setDate(next8Pm.getDate() + 1);
    }
    return next8Pm;
};

const getNext830PmIst = () => {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const nowIst = new Date(nowUtc.getTime() + 330 * 60000);
    const next830Pm = new Date(nowIst);
    next830Pm.setHours(20, 30, 0, 0);
    if (nowIst.getHours() > 20 || (nowIst.getHours() === 20 && nowIst.getMinutes() >= 30)) {
        next830Pm.setDate(next830Pm.getDate() + 1);
    }
    return next830Pm;
};

type RunStatus = "idle" | "running" | "success" | "error" | "stopping";

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
    };

    const handleForceStop = async () => {
        if (runStatus === "running") {
            setRunStatus("stopping");
            setGlobalMessage("Workflow termination requested...");
            const result = await stopWorkflowAction();
            if (result.success) {
                toast({ title: "Stopping Workflow", description: result.message });
            }
        }
    };

    const handleEmergencyKill = async () => {
        setGlobalMessage("🚨 EMERGENCY STOP - Terminating all processes...");
        const result = await emergencyKillSwitch();
        if (result.success) {
            toast({ 
                title: "🚨 Emergency Kill Switch Activated", 
                description: result.message,
                variant: "destructive"
            });
            resetWorkflow();
            router.refresh();
        } else {
            toast({ 
                variant: 'destructive', 
                title: "Emergency Stop Failed", 
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
        setGlobalMessage("Starting workflow...");
        
        const result = await startWorkflowAction(true);
        if (result.success) {
            toast({ title: "Manual Run Started", description: result.message });
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
                    
                    // Update agent statuses from progress
                    if (data.progress) {
                        setAgentStatuses({
                            scout: data.progress.scout?.status as AgentStatus || 'idle',
                            deduplicator: data.progress.deduplicator?.status as AgentStatus || 'idle',
                            journalist: data.progress.journalist?.status as AgentStatus || 'idle',
                            validator: data.progress.validator?.status as AgentStatus || 'idle',
                            editor: data.progress.editor?.status as AgentStatus || 'idle',
                            publisher: data.progress.publisher?.status as AgentStatus || 'idle',
                        });
                    }
                }
            }, (error) => {
                console.error('Error listening to workflow state:', error);
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
            const next8Pm = getNext8PmIst();
            const now = new Date();
            const diff = next8Pm.getTime() - now.getTime();
            setCountdown(formatCountdown(diff));
            
            // Trigger the cycle if we are very close to 8 PM
            if (diff > 0 && diff < 1000 && runStatus === 'idle') {
                startWorkflowAction(false).then(result => {
                    if (result.success) {
                        toast({ title: "Automated Run Started", description: "The daily newspaper generation process has begun." });
                    }
                });
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [mounted, runStatus, toast]);

    // Timer for the next publication
    useEffect(() => {
        if (!mounted) return;
        
        const timerId = setInterval(() => {
            const next830Pm = getNext830PmIst();
            const now = new Date();
            const diff = next830Pm.getTime() - now.getTime();
            setPublishCountdown(formatCountdown(diff));
            
            // Trigger the publication if we are very close to 8:30 PM
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
    }, [toast, router, mounted]);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
               <div className="space-y-1.5 flex-1">
                 <CardTitle>Automated Workflow</CardTitle>
                 <CardDescription>
                    The system runs a full cycle daily at 8 PM IST. You can also trigger it manually.
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
                <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={handleRunWorkflow} disabled={runStatus === 'running' || runStatus === 'stopping'}>
                        <Play className="mr-2 h-4 w-4" />
                        Force Full Run
                    </Button>

                    {(runStatus === 'running' || runStatus === 'stopping') && (
                        <Button variant="destructive" onClick={handleForceStop}>
                            <Square className="mr-2 h-4 w-4" />
                            Force Stop
                        </Button>
                    )}

                    {/* Emergency Kill Switch - Single Click */}
                    {(runStatus === 'running' || runStatus === 'stopping') && (
                        <Button 
                            variant="destructive" 
                            className="bg-red-600 hover:bg-red-700 border-red-700"
                            onClick={handleEmergencyKill}
                        >
                            <Skull className="mr-2 h-4 w-4" />
                            🚨 EMERGENCY KILL
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
