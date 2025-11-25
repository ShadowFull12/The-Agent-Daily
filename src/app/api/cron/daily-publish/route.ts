import { NextRequest, NextResponse } from 'next/server';
import { publishLatestEditionAction } from '@/app/actions';

// Vercel Cron job that PUBLISHES the edition (5:40 AM IST daily)
export async function GET(request: NextRequest) {
  try {
    console.log('📰 Daily publish trigger at 5:40 AM IST');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Publish latest edition
    console.log('📤 Publishing latest edition...');
    const result = await publishLatestEditionAction();
    
    if (!result.success) {
      console.error('❌ Publish failed:', result.message);
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 500 });
    }
    
    console.log('✅ Published successfully:', result.message);
    
    return NextResponse.json({
      success: true,
      message: result.message
    });
    
  } catch (error: any) {
    console.error('❌ Daily publish error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
