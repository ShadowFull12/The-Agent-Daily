'use server';

import { clearAllDataAction } from "@/app/actions";
import { clearWorkflowState } from "@/lib/workflow-state";
import { getFirebaseServices } from "@/lib/firebase-server";
import { doc, setDoc, Timestamp } from "firebase/firestore";

// Emergency kill switch - stops everything immediately
export async function emergencyKillSwitch(): Promise<{ success: boolean; message: string }> {
    try {
        console.log('🚨 EMERGENCY KILL SWITCH ACTIVATED 🚨');
        
        const { firestore } = getFirebaseServices();
        
        // FORCE reset workflow state to idle immediately
        const workflowDoc = doc(firestore, 'workflow_state', 'current_workflow');
        await setDoc(workflowDoc, {
            status: 'idle',
            currentAgent: null,
            message: '🚨 Emergency stop - System reset',
            progress: {
                scout: { status: 'idle', message: '' },
                deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
                journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
                validator: { status: 'idle', message: '' },
                editor: { status: 'idle', message: '' },
                publisher: { status: 'idle', message: '' },
            },
            startedAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),
        }, { merge: false }); // Force overwrite
        
        // Clear all articles and leads
        await clearAllDataAction();
        
        console.log('✅ Emergency kill switch completed');
        
        return { 
            success: true, 
            message: '🚨 Emergency stop complete - All processes terminated and data cleared' 
        };
    } catch (error: any) {
        console.error('Emergency kill switch error:', error);
        
        // Even if there's an error, try to force reset the state
        try {
            const { firestore } = getFirebaseServices();
            const workflowDoc = doc(firestore, 'workflow_state', 'current_workflow');
            await setDoc(workflowDoc, {
                status: 'idle',
                currentAgent: null,
                message: 'System idle',
                progress: {
                    scout: { status: 'idle', message: '' },
                    deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
                    journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
                    validator: { status: 'idle', message: '' },
                    editor: { status: 'idle', message: '' },
                    publisher: { status: 'idle', message: '' },
                },
                startedAt: Timestamp.now(),
                lastUpdated: Timestamp.now(),
            }, { merge: false });
        } catch (resetError) {
            console.error('Failed to force reset:', resetError);
        }
        
        return { 
            success: false, 
            message: `Kill switch error: ${error.message}` 
        };
    }
}
