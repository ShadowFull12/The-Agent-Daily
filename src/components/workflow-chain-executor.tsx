'use client';

import { useEffect } from 'react';

/**
 * WorkflowChainExecutor - SIMPLIFIED CRON-ONLY VERSION
 * 
 * This component no longer executes workflow steps.
 * All workflow execution is handled by Vercel Cron jobs:
 * - /api/cron/daily-workflow: Initializes workflow at 5 AM IST daily
 * - /api/cron/workflow-step: Executes one step per minute
 * 
 * This component is kept for future enhancements but currently does nothing.
 */
export function WorkflowChainExecutor() {
  useEffect(() => {
    console.log('🎬 WorkflowChainExecutor: Cron-only mode - no client-side execution');
    console.log('⏰ All workflow steps handled by Vercel Cron jobs');
    
    // No-op: Cron handles everything
    return () => {
      console.log('🛑 WorkflowChainExecutor unmounting');
    };
  }, []);

  return null; // This component has no UI and no execution logic
}
