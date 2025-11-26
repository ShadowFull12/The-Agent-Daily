'use client';

import { useEffect, useRef } from 'react';
import { executeNextWorkflowStep } from '@/app/actions-workflow-chained';
import { getQueueState } from '@/app/workflow-queue';

export function WorkflowChainExecutor() {
  const isExecutingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const immediateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const checkAndExecute = async () => {
      // Prevent concurrent executions
      if (isExecutingRef.current) {
        console.log('⏳ Already executing, skipping...');
        return;
      }

      try {
        isExecutingRef.current = true;
        
        // Check if there's work to do
        const state = await getQueueState();
        console.log(`📊 Queue State Check: currentStep="${state?.currentStep || 'none'}", isManualRun=${state?.isManualRun || false}`);
        
        // CRITICAL: Only execute for MANUAL runs (isManualRun === true)
        // Cron handles automatic runs, client executor handles manual runs
        if (!state?.isManualRun) {
          console.log(`⏭️ Not a manual run - cron will handle execution. Stopping client executor.`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          if (immediateTimeoutRef.current) {
            clearTimeout(immediateTimeoutRef.current);
            immediateTimeoutRef.current = undefined;
          }
          isExecutingRef.current = false;
          return;
        }
        
        if (!state || state.currentStep === 'idle' || state.currentStep === 'complete' || state.currentStep === 'error') {
          // No work to do, stop checking
          console.log(`✋ Workflow not active. Stopping executor.`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          if (immediateTimeoutRef.current) {
            clearTimeout(immediateTimeoutRef.current);
            immediateTimeoutRef.current = undefined;
          }
          isExecutingRef.current = false;
          return;
        }

        console.log(`🔄 [MANUAL RUN] Executing step: ${state.currentStep}`);
        const result = await executeNextWorkflowStep();
        console.log(`📋 [MANUAL RUN] Step result: success=${result.success}, nextStep=${result.nextStep}, completed=${result.completed}`);
        
        // Force UI update by triggering a state check
        // Note: Firestore onSnapshot should handle this, but we trigger anyway for immediate feedback
        
        if (result.completed) {
          console.log(`✅ [MANUAL RUN] Workflow completed: ${result.message}`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          if (immediateTimeoutRef.current) {
            clearTimeout(immediateTimeoutRef.current);
            immediateTimeoutRef.current = undefined;
          }
        } else if (result.success && result.nextStep) {
          console.log(`➡️ [MANUAL RUN] Step completed successfully. Next step: ${result.nextStep}. Triggering immediate check in 1 second...`);
          // Clear any existing immediate timeout
          if (immediateTimeoutRef.current) {
            clearTimeout(immediateTimeoutRef.current);
          }
          // Schedule immediate next step execution
          immediateTimeoutRef.current = setTimeout(() => {
            console.log('⚡ [MANUAL RUN] Immediate trigger executing...');
            isExecutingRef.current = false;
            checkAndExecute();
          }, 1000);
          return; // Don't reset flag yet - timeout will do it
        } else if (!result.success) {
          console.error(`❌ [MANUAL RUN] Step failed: ${result.error}. Stopping executor.`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        } else {
          console.log(`⏸️ [MANUAL RUN] Step returned without nextStep. Result:`, result);
        }
        
      } catch (error) {
        console.error('❌ Execution error:', error);
      } finally {
        isExecutingRef.current = false;
      }
    };

    console.log('🎬 WorkflowChainExecutor started - polling every 500ms (MANUAL RUNS ONLY)');
    
    // Check every 500ms for pending work (real-time updates)
    intervalRef.current = setInterval(checkAndExecute, 500);
    
    // Also check immediately on mount
    checkAndExecute();

    return () => {
      console.log('🛑 WorkflowChainExecutor unmounting - cleaning up');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (immediateTimeoutRef.current) {
        clearTimeout(immediateTimeoutRef.current);
      }
    };
  }, []);

  return null; // This component has no UI
}
