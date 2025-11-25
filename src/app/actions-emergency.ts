'use server';

import { clearAllDataAction } from "@/app/actions";
import { updateWorkflowState, clearWorkflowState } from "@/lib/workflow-state";

// Emergency kill switch - stops everything immediately
export async function emergencyKillSwitch(): Promise<{ success: boolean; message: string }> {
    try {
        console.log('🚨 EMERGENCY KILL SWITCH ACTIVATED 🚨');
        
        // Clear all workflow data
        await clearWorkflowState();
        
        // Clear all articles and leads
        await clearAllDataAction();
        
        // Reset workflow state to idle
        await updateWorkflowState({
            status: 'idle',
            currentAgent: null,
            message: '🚨 Emergency stop activated - All processes terminated',
        });
        
        return { 
            success: true, 
            message: '🚨 Emergency kill switch activated - All processes stopped and data cleared' 
        };
    } catch (error: any) {
        console.error('Emergency kill switch error:', error);
        return { 
            success: false, 
            message: `Kill switch failed: ${error.message}` 
        };
    }
}
