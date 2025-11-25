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

// Step 3: Journalist - drafts ALL articles (completes in < 250s for ~20 articles)
export async function executeStep3_Journalist(): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    console.log('📋 Step 3: Journalist');
    
    await updateAgentProgress('journalist', 'working', 'Journalist is drafting articles...');
    let remaining = -1;
    let draftsMade = 0;
    
    // Process all leads
    do {
      const draftResult = await draftArticleAction();
      
      if (!draftResult.success && draftResult.error) {
        console.warn('Draft failed:', draftResult.error);
      } else if (draftResult.articleId) {
        draftsMade++;
        await updateAgentProgress('journalist', 'working', `Journalist drafted ${draftsMade} articles. ${draftResult.remaining} leads left.`, { 
          drafted: draftsMade, 
          remaining: draftResult.remaining 
        });
      }
      
      remaining = draftResult.remaining;
      
      if (remaining > 0) {
        await sleep(1000); // Brief pause between drafts
      }
    } while (remaining > 0);
    
    await updateAgentProgress('journalist', 'success', `Journalist drafted ${draftsMade} articles.`);
    await updateQueueState({ currentStep: 'validate', draftsMade });
    
    return { success: true, message: `Drafted ${draftsMade} articles. Proceeding to validation...` };
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
    
    switch (state.currentStep) {
      case 'clear_data':
      case 'scout':
        const result1 = await executeStep1_ClearAndScout();
        return { ...result1, nextStep: 'dedup' };
        
      case 'dedup':
        const result2 = await executeStep2_Dedup();
        return { ...result2, nextStep: 'journalist' };
        
      case 'journalist':
        const result3 = await executeStep3_Journalist();
        return { ...result3, nextStep: 'validate' };
        
      case 'validate':
      case 'editor':
        const result4 = await executeStep4_ValidateAndEdit();
        const nextState = await getQueueState();
        return { 
          ...result4, 
          nextStep: nextState?.currentStep === 'clear_data' ? 'clear_data' : 'complete',
          completed: nextState?.currentStep === 'complete'
        };
        
      default:
        return { success: false, message: 'Unknown step', error: 'Unknown workflow step' };
    }
    
  } catch (error: any) {
    console.error('Workflow step execution error:', error);
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: error.message, error: error.message };
  }
}

// Start the workflow
export async function startChainedWorkflow(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🚀 Starting chained workflow...');
    await clearQueueState();
    await updateQueueState({ currentStep: 'clear_data', attempt: 1, draftsMade: 0 });
    await updateWorkflowState({ status: 'running', message: 'Workflow started' });
    
    // Execute the first step immediately instead of waiting for the client executor
    console.log('⚡ Executing first step immediately...');
    const firstStepResult = await executeNextWorkflowStep();
    
    if (!firstStepResult.success) {
      return { success: false, message: `First step failed: ${firstStepResult.error}` };
    }
    
    return { success: true, message: `Workflow started. First step: ${firstStepResult.message}` };
  } catch (error: any) {
    console.error('❌ Failed to start workflow:', error);
    return { success: false, message: error.message };
  }
}

// Stop the workflow
export async function stopChainedWorkflow(): Promise<{ success: boolean; message: string }> {
  await clearQueueState();
  await updateWorkflowState({ status: 'idle', message: 'Workflow stopped' });
  return { success: true, message: 'Workflow stopped' };
}
