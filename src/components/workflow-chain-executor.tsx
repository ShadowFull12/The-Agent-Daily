'use client';

import { useEffect, useRef } from 'react';
import { executeNextWorkflowStep } from '@/app/actions-workflow-chained';
import { getQueueState } from '@/app/workflow-queue';

export function WorkflowChainExecutor() {
  const isExecutingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const checkAndExecute = async () => {
      // Prevent concurrent executions
      if (isExecutingRef.current) {
        console.log('⏳ Already executing, skipping...');
        return;
      }

      try {
        // Check if there's work to do
        const state = await getQueueState();
        
        if (!state || state.currentStep === 'idle' || state.currentStep === 'complete' || state.currentStep === 'error') {
          // No work to do, stop checking
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          return;
        }

        console.log(`🔄 Queue status: ${state.currentStep}, executing next step...`);
        isExecutingRef.current = true;
        
        const result = await executeNextWorkflowStep();
        
        if (result.completed) {
          console.log(`✅ Workflow completed: ${result.message}`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        } else if (result.success && result.nextStep) {
          console.log(`➡️ Step completed. Next: ${result.nextStep}. Message: ${result.message}`);
          // Immediately trigger next step check
          setTimeout(checkAndExecute, 1000);
        } else if (!result.success) {
          console.error(`❌ Step failed: ${result.error}`);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        }
        
      } catch (error) {
        console.error('❌ Execution error:', error);
      } finally {
        isExecutingRef.current = false;
      }
    };

    // Check every 3 seconds for pending work
    intervalRef.current = setInterval(checkAndExecute, 3000);
    
    // Also check immediately
    checkAndExecute();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return null; // This component has no UI
}
