import { NextRequest, NextResponse } from 'next/server';
import { executeNextWorkflowStep } from '@/app/actions-workflow-chained';
import { getQueueState } from '@/app/workflow-queue';

// Vercel Cron job that executes ONE workflow step
// This endpoint is called repeatedly by Vercel Cron (every minute)
// Each call is a separate function invocation (separate 300s limit)
export async function GET(request: NextRequest) {
  try {
    console.log('🔔 Cron triggered: Checking workflow queue...');
    
    // Verify cron authorization (only if CRON_SECRET is set)
    if (process.env.CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('⚠️ Unauthorized cron request (wrong or missing auth header)');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Cron authentication successful');
    } else {
      console.log('ℹ️ CRON_SECRET not set - allowing request without auth');
    }
    
    // Check if there's work to do
    const state = await getQueueState();
    console.log(`📋 Current queue state:`, {
      currentStep: state?.currentStep || 'none',
      isExecuting: state?.isExecuting || false,
      attempt: state?.attempt || 0,
      isManualRun: state?.isManualRun || false
    });
    
    if (!state || state.currentStep === 'idle' || state.currentStep === 'complete') {
      console.log('✅ No work to do. Workflow is idle/complete.');
      return NextResponse.json({ 
        success: true, 
        message: 'No workflow running',
        currentStep: state?.currentStep || 'idle'
      });
    }
    
    if (state.currentStep === 'error') {
      console.error('❌ Workflow is in error state');
      console.error('❌ Error details:', state.error || 'No error message available');
      console.error('❌ Last step attempted:', {
        attempt: state.attempt,
        validCount: state.validCount,
        draftsMade: state.draftsMade
      });
      return NextResponse.json({ 
        success: false, 
        message: 'Workflow in error state',
        error: state.error || 'Unknown error'
      });
    }
    
    // Check if another execution is in progress (prevent concurrent cron runs)
    if (state.isExecuting) {
      const executionStartedAt = state.executionStartedAt?.toMillis ? state.executionStartedAt.toMillis() : Date.now();
      const elapsedTime = Date.now() - executionStartedAt;
      const timeoutThreshold = 6 * 60 * 1000; // 6 minutes timeout
      
      if (elapsedTime < timeoutThreshold) {
        console.log(`⏸️ Cron: Skipping - step already executing for ${Math.floor(elapsedTime / 1000)}s`);
        return NextResponse.json({ 
          success: true, 
          message: 'Step already executing',
          currentStep: state.currentStep,
          elapsedSeconds: Math.floor(elapsedTime / 1000)
        });
      } else {
        console.warn(`⚠️ Execution lock timeout (${Math.floor(elapsedTime / 1000)}s) - clearing lock and proceeding`);
        // Clear the stuck lock
        const { updateQueueState } = await import('@/app/workflow-queue');
        await updateQueueState({ isExecuting: false, executionStartedAt: null as any });
      }
    }
    
    // Set execution lock before starting work
    const { updateQueueState } = await import('@/app/workflow-queue');
    const { Timestamp } = await import('firebase/firestore');
    await updateQueueState({ 
      isExecuting: true, 
      executionStartedAt: Timestamp.now() 
    });
    
    console.log(`⚡ Executing step: ${state.currentStep} [Lock acquired]`);
    
    try {
      const result = await executeNextWorkflowStep();
      
      // Clear execution lock after completion
      await updateQueueState({ isExecuting: false, executionStartedAt: null as any });
      
      console.log(`📊 Step result: success=${result.success}, nextStep=${result.nextStep || 'none'} [Lock released]`);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        currentStep: state.currentStep,
        nextStep: result.nextStep,
        completed: result.completed,
        error: result.error
      });
    } catch (error: any) {
      // Clear lock on error
      await updateQueueState({ isExecuting: false, executionStartedAt: null as any });
      throw error;
    }
    
  } catch (error: any) {
    console.error('❌ Cron execution error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Allow manual triggering via POST (for testing)
export async function POST(request: NextRequest) {
  return GET(request);
}
