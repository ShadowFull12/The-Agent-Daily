import { NextRequest, NextResponse } from 'next/server';
import { startChainedWorkflow } from '@/app/actions-workflow-chained';

// Vercel Cron job that STARTS the workflow (5:00 AM IST daily)
// This only initializes the queue, then workflow-step cron takes over
export async function GET(request: NextRequest) {
  try {
    console.log('🌅 Daily workflow trigger at 5:00 AM IST');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Start workflow (just initializes queue)
    console.log('🚀 Initializing workflow...');
    const result = await startChainedWorkflow();
    
    console.log(`📊 Workflow initialization: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      note: 'Workflow initialized. Step execution will be handled by workflow-step cron.'
    });
    
  } catch (error: any) {
    console.error('❌ Daily trigger error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
