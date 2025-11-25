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
export async function executeStep1_ClearAndScout(): Promise<{ success: boolean; message: string; error?: string }> {
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
    
    await updateAgentProgress('scout', 'success', `Scout found ${scoutResult.leadCount} leads.`);
    await updateQueueState({ currentStep: 'dedup' });
    
    return { success: true, message: `Found ${scoutResult.leadCount} leads. Proceeding to deduplication...` };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 1 failed', error: error.message };
  }
}

// Step 2: Deduplication (completes in < 30s)
export async function executeStep2_Dedup(): Promise<{ success: boolean; message: string; error?: string }> {
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
    await updateQueueState({ currentStep: 'journalist', draftsMade: 0 });
    
    return { success: true, message: `Removed ${dedupResult.deletedCount} duplicates. Proceeding to journalist...` };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 2 failed', error: error.message };
  }
}

// Step 3: Journalist - drafts ALL articles with 5 parallel workers (completes in ~50-80s)
export async function executeStep3_Journalist(): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    console.log('📋 Step 3: Journalist (5 parallel workers)');
    
    await updateAgentProgress('journalist', 'working', 'Journalist team (5 workers) is drafting articles...');
    let draftsMade = 0;
    
    // Process leads in parallel batches of 5
    let hasMoreLeads = true;
    
    while (hasMoreLeads) {
      // Create 5 parallel draft promises
      const draftPromises = Array(5).fill(null).map(() => draftArticleAction());
      
      // Wait for all 5 to complete
      const results = await Promise.all(draftPromises);
      
      // Count successes
      let batchSuccess = 0;
      let remainingCount = 0;
      
      results.forEach(result => {
        if (result.articleId) {
          batchSuccess++;
          draftsMade++;
        }
        remainingCount = result.remaining;
      });
      
      console.log(`📰 Batch completed: ${batchSuccess} articles drafted, ${remainingCount} leads remaining`);
      
      await updateAgentProgress('journalist', 'working', `Journalist team drafted ${draftsMade} articles. ${remainingCount} leads left.`, { 
        drafted: draftsMade, 
        remaining: remainingCount 
      });
      
      // Check if more leads remain
      if (remainingCount === 0) {
        hasMoreLeads = false;
      } else {
        await sleep(500); // Brief pause between batches
      }
    }
    
    await updateAgentProgress('journalist', 'success', `Journalist team drafted ${draftsMade} articles with 5 parallel workers.`);
    await updateQueueState({ currentStep: 'validate', draftsMade });
    
    return { success: true, message: `Drafted ${draftsMade} articles using parallel processing. Proceeding to validation...` };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 3 failed', error: error.message };
  }
}

// Step 4: Validate and Editor (completes in < 60s)
export async function executeStep4_ValidateAndEdit(): Promise<{ success: boolean; message: string; error?: string }> {
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
      
      return { success: true, message: `Edition created with ${validationResult.validCount} articles!` };
      
    } else if ((state?.attempt || 1) < 3) {
      // Need more articles, retry from scout
      await updateAgentProgress('validator', 'working', `Need more articles (${validationResult.validCount}/20). Retrying scout...`);
      await updateQueueState({ 
        currentStep: 'clear_data', 
        attempt: (state?.attempt || 1) + 1,
        validCount: validationResult.validCount 
      });
      
      return { success: true, message: `Only ${validationResult.validCount} articles. Retrying (${(state?.attempt || 1) + 1}/3)...` };
      
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

// Main orchestrator - checks queue and executes next step
// Now fully server-side: each step triggers the next automatically
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
    
    console.log(`🎯 Executing workflow step: ${state.currentStep}`);
    
    let result: any;
    let shouldContinue = false;
    
    switch (state.currentStep) {
      case 'clear_data':
      case 'scout':
        result = await executeStep1_ClearAndScout();
        shouldContinue = result.success;
        break;
        
      case 'dedup':
        result = await executeStep2_Dedup();
        shouldContinue = result.success;
        break;
        
      case 'journalist':
        result = await executeStep3_Journalist();
        shouldContinue = result.success;
        break;
        
      case 'validate':
      case 'editor':
        result = await executeStep4_ValidateAndEdit();
        const nextState = await getQueueState();
        result.nextStep = nextState?.currentStep === 'clear_data' ? 'clear_data' : 'complete';
        result.completed = nextState?.currentStep === 'complete';
        shouldContinue = result.success && nextState?.currentStep === 'clear_data';
        break;
        
      default:
        return { success: false, message: 'Unknown step', error: 'Unknown workflow step' };
    }
    
    // Server-side auto-chaining: if successful and not completed, execute next step
    if (shouldContinue && !result.completed) {
      console.log(`➡️ Auto-executing next step: ${result.nextStep}`);
      await sleep(1000); // Brief pause
      return await executeNextWorkflowStep(); // Recursive call for next step
    }
    
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
