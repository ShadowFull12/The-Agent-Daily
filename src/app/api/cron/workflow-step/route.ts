import { NextRequest, NextResponse } from 'next/server';
import { executeNextWorkflowStep } from '@/app/actions-workflow-chained';
import { getQueueState } from '@/app/workflow-queue';

// Vercel Cron job that executes ONE workflow step
// This endpoint is called repeatedly by Vercel Cron (every minute)
// Each call is a separate function invocation (separate 300s limit)
export async function GET(request: NextRequest) {
  try {
    console.log('🔔 Cron triggered: Checking workflow queue...');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if there's work to do
    const state = await getQueueState();
    console.log(`📋 Current queue state: ${state?.currentStep || 'none'}`);
    
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
      return NextResponse.json({ 
        success: false, 
        message: 'Workflow in error state',
        error: state.error 
      });
    }
    
    // Check if this is a manual run (skip cron execution to prevent duplicates)
    if (state.isManualRun) {
      console.log('⏭️ Cron: Skipping execution - manual run in progress (client executor handling steps)');
      return NextResponse.json({ 
        success: true, 
        message: 'Manual run in progress - client executor handling steps',
        currentStep: state.currentStep
      });
    }
    
    // Execute ONE step
    console.log(`⚡ Executing step: ${state.currentStep}`);
    const result = await executeNextWorkflowStep();
    
    console.log(`📊 Step result: success=${result.success}, nextStep=${result.nextStep || 'none'}`);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      currentStep: state.currentStep,
      nextStep: result.nextStep,
      completed: result.completed,
      error: result.error
    });
    
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
