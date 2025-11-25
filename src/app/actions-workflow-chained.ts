'use server';

import { 
  clearAllDataAction,
  findLeadsAction,
  draftArticleAction,
  validateArticlesAction,
  createPreviewEditionAction
} from "@/app/actions";
import { getQueueState, updateQueueState, clearQueueState } from "@/app/workflow-queue";
import { updateAgentProgress, updateWorkflowState } from "@/lib/workflow-state";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Step 1: Clear data and scout (completes in < 60s)
export async function executeStep1_ClearAndScout(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('📋 Step 1: Clear data and scout');
    
    // Clear data
    await updateAgentProgress('scout', 'working', 'Clearing previous data...');
    const clearResult = await clearAllDataAction();
    if (!clearResult.success) {
      await updateQueueState({ currentStep: 'error', error: clearResult.error });
      return { success: false, message: 'Failed to clear data', error: clearResult.error };
    }
    
    const state = await getQueueState();
    const attempt = state?.attempt || 1;
    
    // Scout for 25 leads
    await updateAgentProgress('scout', 'working', `Scout is gathering news leads (Attempt ${attempt}/3)...`);
    const scoutResult = await findLeadsAction(25);
    
    if (!scoutResult.success) {
      await updateQueueState({ currentStep: 'error', error: scoutResult.error });
      return { success: false, message: 'Scout failed', error: scoutResult.error };
    }
    
    await updateAgentProgress('scout', 'success', `Scout found ${scoutResult.leadCount} breaking news leads.`);
    await updateQueueState({ currentStep: 'dedup' });
    
    console.log('✅ Step 1 COMPLETE: Scout finished. Next step: Deduplication');
    return { success: true, message: `Scout found ${scoutResult.leadCount} leads. Proceeding to deduplication...`, nextStep: 'dedup' };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 1 failed', error: error.message };
  }
}

// Step 2: Deduplication (completes in < 30s)
export async function executeStep2_Dedup(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('📋 Step 2: Deduplication');
    
    await updateAgentProgress('deduplicator', 'working', 'AI Deduplicator is analyzing all leads...');
    const { deduplicateLeadsActionBatch } = await import('@/app/actions-dedup-new');
    const dedupResult = await deduplicateLeadsActionBatch();
    
    if (!dedupResult.success) {
      await updateQueueState({ currentStep: 'error', error: dedupResult.error });
      return { success: false, message: 'Deduplication failed', error: dedupResult.error };
    }
    
    await updateAgentProgress('deduplicator', 'success', `Removed ${dedupResult.deletedCount} duplicates. ${dedupResult.totalLeads} unique leads remain.`);
    await updateQueueState({ currentStep: 'journalist_1', draftsMade: 0 });
    
    console.log('✅ Step 2 COMPLETE: Deduplication finished. Next step: Journalist 1');
    return { success: true, message: `Removed ${dedupResult.deletedCount} duplicates. Proceeding to journalist_1...`, nextStep: 'journalist_1' };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 2 failed', error: error.message };
  }
}

// Step 3.1: Journalist 1
export async function executeStep3_Journalist1(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  return await executeSingleJournalist('journalist_1', 'journalist_2');
}

// Step 3.2: Journalist 2
export async function executeStep3_Journalist2(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  return await executeSingleJournalist('journalist_2', 'journalist_3');
}

// Step 3.3: Journalist 3
export async function executeStep3_Journalist3(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  return await executeSingleJournalist('journalist_3', 'journalist_4');
}

// Step 3.4: Journalist 4
export async function executeStep3_Journalist4(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  return await executeSingleJournalist('journalist_4', 'journalist_5');
}

// Step 3.5: Journalist 5
export async function executeStep3_Journalist5(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  return await executeSingleJournalist('journalist_5', 'validate');
}

// Execute a single journalist process
async function executeSingleJournalist(journalistId: string, nextStep: string): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log(`📋 Step: ${journalistId}`);
    
    await updateAgentProgress(journalistId as any, 'working', 'Starting...', { drafted: 0 });
    
    const result = await runJournalistProcess(journalistId);
    
    await updateAgentProgress(journalistId as any, 'success', `Completed ${result.drafted} article${result.drafted !== 1 ? 's' : ''}`, { 
      drafted: result.drafted 
    });
    
    // Update total drafted count
    const state = await getQueueState();
    const totalDrafts = (state?.draftsMade || 0) + result.drafted;
    
    // Update journalist aggregated status
    await updateAgentProgress('journalist', 'working', `Total: ${totalDrafts} articles drafted`, { 
      drafted: totalDrafts, 
      remaining: 0 
    });
    
    await updateQueueState({ currentStep: nextStep as any, draftsMade: totalDrafts });
    
    console.log(`✅ ${journalistId} COMPLETE: Drafted ${result.drafted} articles. Total: ${totalDrafts}. Next step: ${nextStep}`);
    return { success: true, message: `${journalistId} drafted ${result.drafted} article(s). Total: ${totalDrafts}`, nextStep };
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: `${journalistId} failed`, error: error.message };
  }
}

// Individual journalist worker process
async function runJournalistProcess(journalistId: string): Promise<{ drafted: number }> {
  let drafted = 0;
  let hasMoreLeads = true;
  let consecutiveErrors = 0;
  
  console.log(`📰 ${journalistId} starting...`);
  
  while (hasMoreLeads && consecutiveErrors < 3) {
    try {
      const result = await draftArticleAction(journalistId);
      
      if (result.success && result.articleId) {
        drafted++;
        consecutiveErrors = 0; // Reset error counter on success
        await updateAgentProgress(journalistId as any, 'working', `Drafted ${drafted} article${drafted > 1 ? 's' : ''}`, { 
          drafted 
        });
        console.log(`📰 ${journalistId} drafted article: ${result.headline} (${result.remaining} leads left)`);
        
        // Check if more leads remain
        if (result.remaining === 0) {
          hasMoreLeads = false;
          await updateAgentProgress(journalistId as any, 'success', `Completed ${drafted} article${drafted > 1 ? 's' : ''}`, { 
            drafted 
          });
          console.log(`✅ ${journalistId} completed with ${drafted} articles`);
        } else {
          await sleep(200); // Brief pause between drafts
        }
      } else if (result.remaining === 0) {
        // No more leads, exit gracefully
        hasMoreLeads = false;
        await updateAgentProgress(journalistId as any, 'success', `Completed ${drafted} article${drafted > 1 ? 's' : ''}`, { 
          drafted 
        });
        console.log(`✅ ${journalistId} completed with ${drafted} articles (no more leads)`);
      } else if (result.error) {
        consecutiveErrors++;
        console.error(`❌ ${journalistId} error (${consecutiveErrors}/3):`, result.error);
        if (consecutiveErrors < 3) {
          await sleep(1000); // Wait before retry
        }
      }
    } catch (error: any) {
      consecutiveErrors++;
      console.error(`❌ ${journalistId} exception (${consecutiveErrors}/3):`, error.message);
      if (consecutiveErrors < 3) {
        await sleep(1000);
      } else {
        await updateAgentProgress(journalistId as any, 'error', `Failed after 3 errors`, { drafted });
        break;
      }
    }
  }
  
  return { drafted };
}

// Step 4: Validate and Editor (completes in < 60s)
export async function executeStep4_ValidateAndEdit(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string; completed?: boolean }> {
  try {
    console.log('📋 Step 4: Validate and Editor');
    
    const state = await getQueueState();
    
    // Validate
    await updateAgentProgress('validator', 'working', 'Validating article quality...');
    const validationResult = await validateArticlesAction();
    
    if (!validationResult.success) {
      await updateQueueState({ currentStep: 'error', error: validationResult.error });
      return { success: false, message: 'Validation failed', error: validationResult.error };
    }
    
    await updateAgentProgress('validator', 'working', `Validator approved ${validationResult.validCount} articles, discarded ${validationResult.discardedCount}.`);
    
    // Check if we have enough articles (20+)
    if (validationResult.validCount >= 20) {
      await updateAgentProgress('validator', 'success', `Article count sufficient (${validationResult.validCount}). Proceeding to layout.`);
      
      // Create edition
      await updateAgentProgress('editor', 'working', 'Chief Editor is designing layout...');
      const editorResult = await createPreviewEditionAction();
      
      if (!editorResult.success) {
        await updateQueueState({ currentStep: 'error', error: editorResult.error });
        return { success: false, message: 'Editor failed', error: editorResult.error };
      }
      
      await updateAgentProgress('editor', 'success', `Edition created: ${editorResult.editionId}`);
      await updateQueueState({ currentStep: 'complete', validCount: validationResult.validCount });
      await updateWorkflowState({ status: 'success', message: 'Workflow completed successfully!' });
      
      console.log(`✅ Step 9 COMPLETE: Editor finished. Workflow complete with ${validationResult.validCount} articles!`);
      return { success: true, message: `Edition created with ${validationResult.validCount} articles!`, completed: true };
      
    } else if ((state?.attempt || 1) < 3) {
      // Need more articles, retry from scout
      await updateAgentProgress('validator', 'working', `Need more articles (${validationResult.validCount}/20). Retrying scout...`);
      await updateQueueState({ 
        currentStep: 'clear_data', 
        attempt: (state?.attempt || 1) + 1,
        validCount: validationResult.validCount 
      });
      
      console.log(`⚠️ Only ${validationResult.validCount} articles. Retrying from Scout (attempt ${(state?.attempt || 1) + 1}/3)`);
      return { success: true, message: `Only ${validationResult.validCount} articles. Retrying (${(state?.attempt || 1) + 1}/3)...`, nextStep: 'clear_data' };
      
    } else {
      // Failed after 3 attempts
      const error = `Failed to get 20 articles after 3 attempts (got ${validationResult.validCount})`;
      await updateQueueState({ currentStep: 'error', error });
      await updateWorkflowState({ status: 'error', message: error });
      return { success: false, message: error, error };
    }
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 4 failed', error: error.message };
  }
}

// Main orchestrator - checks queue and executes ONE step only
// Client or scheduler must call this repeatedly to advance workflow
export async function executeNextWorkflowStep(): Promise<{ 
  success: boolean; 
  message: string; 
  nextStep?: string;
  completed?: boolean;
  error?: string;
}> {
  try {
    const state = await getQueueState();
    
    if (!state || state.currentStep === 'idle') {
      return { success: true, message: 'No workflow running', completed: true };
    }
    
    if (state.currentStep === 'complete') {
      await clearQueueState();
      return { success: true, message: 'Workflow completed', completed: true };
    }
    
    if (state.currentStep === 'error') {
      await updateWorkflowState({ status: 'error', message: state.error || 'Unknown error' });
      return { success: false, message: state.error || 'Unknown error', completed: true, error: state.error };
    }
    
    console.log(`🎯 ========================================`);
    console.log(`🎯 STARTING STEP: ${state.currentStep}`);
    console.log(`🎯 ========================================`);
    
    let result: any;
    
    switch (state.currentStep) {
      case 'clear_data':
      case 'scout':
        console.log('📋 Executing: Step 1 - Clear & Scout');
        result = await executeStep1_ClearAndScout();
        break;
        
      case 'dedup':
        console.log('📋 Executing: Step 2 - Deduplication');
        result = await executeStep2_Dedup();
        break;
        
      case 'journalist_1':
        console.log('📋 Executing: Step 3.1 - Journalist 1');
        result = await executeStep3_Journalist1();
        break;
        
      case 'journalist_2':
        console.log('📋 Executing: Step 3.2 - Journalist 2');
        result = await executeStep3_Journalist2();
        break;
        
      case 'journalist_3':
        console.log('📋 Executing: Step 3.3 - Journalist 3');
        result = await executeStep3_Journalist3();
        break;
        
      case 'journalist_4':
        console.log('📋 Executing: Step 3.4 - Journalist 4');
        result = await executeStep3_Journalist4();
        break;
        
      case 'journalist_5':
        console.log('📋 Executing: Step 3.5 - Journalist 5');
        result = await executeStep3_Journalist5();
        break;
        
      case 'validate':
      case 'editor':
        console.log('📋 Executing: Step 4 - Validate & Editor');
        result = await executeStep4_ValidateAndEdit();
        const nextState = await getQueueState();
        result.nextStep = nextState?.currentStep === 'clear_data' ? 'clear_data' : 'complete';
        result.completed = nextState?.currentStep === 'complete';
        break;
        
      default:
        return { success: false, message: 'Unknown step', error: 'Unknown workflow step' };
    }
    
    console.log(`✅ STEP COMPLETED: ${state.currentStep}`);
    console.log(`📊 Result: success=${result.success}, nextStep=${result.nextStep || 'none'}, completed=${result.completed || false}`);
    console.log(`🎯 ========================================\n`);
    
    // Return result - let client/executor call again for next step
    return result;
    
  } catch (error: any) {
    console.error('Workflow step execution error:', error);
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: error.message, error: error.message };
  }
}

// Start the workflow - FULLY SERVER-SIDE
// Executes all steps recursively on the server, no client needed
export async function startChainedWorkflow(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🚀 Starting FULLY server-side chained workflow...');
    await clearQueueState();
    await updateQueueState({ currentStep: 'clear_data', attempt: 1, draftsMade: 0 });
    await updateWorkflowState({ status: 'running', message: 'Workflow started' });
    
    // Execute ALL steps server-side recursively
    console.log('⚡ Executing complete workflow server-side...');
    const finalResult = await executeNextWorkflowStep();
    
    if (!finalResult.success) {
      return { success: false, message: `Workflow failed: ${finalResult.error}` };
    }
    
    if (finalResult.completed) {
      return { success: true, message: `Workflow completed successfully! ${finalResult.message}` };
    }
    
    return { success: true, message: `Workflow in progress: ${finalResult.message}` };
  } catch (error: any) {
    console.error('❌ Failed to start workflow:', error);
    await updateQueueState({ currentStep: 'error', error: error.message });
    await updateWorkflowState({ status: 'error', message: error.message });
    return { success: false, message: error.message };
  }
}

// Stop the workflow
export async function stopChainedWorkflow(): Promise<{ success: boolean; message: string }> {
  await clearQueueState();
  await updateWorkflowState({ status: 'idle', message: 'Workflow stopped' });
  return { success: true, message: 'Workflow stopped' };
}
