'use server';

import { 
  clearAllDataAction,
  findLeadsAction,
  draftArticleAction,
  validateArticlesAction,
  createPreviewEditionAction,
  createInitialLayoutAction,
  refineLayoutAction
} from "@/app/actions";
import { getQueueState, updateQueueState, clearQueueState } from "@/app/workflow-queue";
import { updateAgentProgress, updateWorkflowState } from "@/lib/workflow-state";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Step 1: Clear data and scout (completes in < 60s)
export async function executeStep1_ClearAndScout(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('📋 Step 1: Clear data and scout');
    
    await updateWorkflowState({ status: 'running', message: 'Step 1: Clearing data and scouting for news...' });
    
    // Clear data
    await updateAgentProgress('scout', 'working', 'Clearing previous data...');
    const clearResult = await clearAllDataAction();
    if (!clearResult.success) {
      await updateQueueState({ currentStep: 'error', error: clearResult.error });
      return { success: false, message: 'Failed to clear data', error: clearResult.error };
    }
    
    const state = await getQueueState();
    const attempt = state?.attempt || 1;
    
    // Scout for leads: 45 on first attempt, 5 on retries
    const leadsToFind = attempt === 1 ? 45 : 5;
    await updateAgentProgress('scout', 'working', `Scout is gathering news leads (Attempt ${attempt}/3)...`);
    const scoutResult = await findLeadsAction(leadsToFind);
    
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
    
    await updateWorkflowState({ status: 'running', message: 'Step 2: Deduplicating leads...' });
    
    await updateAgentProgress('deduplicator', 'working', 'AI Deduplicator is analyzing all leads...');
    const { deduplicateLeadsActionBatch } = await import('@/app/actions-dedup-new');
    const dedupResult = await deduplicateLeadsActionBatch();
    
    if (!dedupResult.success) {
      await updateQueueState({ currentStep: 'error', error: dedupResult.error });
      return { success: false, message: 'Deduplication failed', error: dedupResult.error };
    }
    
    await updateAgentProgress('deduplicator', 'success', `Removed ${dedupResult.deletedCount} duplicates. ${dedupResult.totalLeads} unique leads remain.`, { 
      deleted: dedupResult.deletedCount, 
      passed: dedupResult.totalLeads 
    });
    await updateQueueState({ currentStep: 'distribute_leads', draftsMade: 0 });
    
    console.log('✅ Step 2 COMPLETE: Deduplication finished. Next step: Distribute leads');
    return { success: true, message: `Removed ${dedupResult.deletedCount} duplicates. Proceeding to distribute leads...`, nextStep: 'distribute_leads' };
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 2 failed', error: error.message };
  }
}

// Step 3: Distribute leads to journalist-specific collections
export async function executeStep3_DistributeLeads(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('📋 Step 3: Distributing leads to journalists');
    
    await updateWorkflowState({ status: 'running', message: 'Step 3: Distributing leads to 5 journalists...' });
    
    await updateAgentProgress('journalist', 'working', 'Distributing leads to 5 journalists...');
    
    const { firestore } = await import('@/lib/firebase-server').then(m => m.getFirebaseServices());
    const { collection, getDocs, writeBatch, doc, Timestamp } = await import('firebase/firestore');
    
    // Get all raw leads
    const leadsSnapshot = await getDocs(collection(firestore, 'raw_leads'));
    const allLeads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (allLeads.length === 0) {
      await updateQueueState({ currentStep: 'error', error: 'No leads to distribute' });
      return { success: false, message: 'No leads found to distribute', error: 'No leads available' };
    }
    
    // Divide leads equally among 5 journalists
    const journalists = ['journalist_1', 'journalist_2', 'journalist_3', 'journalist_4', 'journalist_5'];
    const leadsPerJournalist = Math.ceil(allLeads.length / journalists.length);
    
    console.log(`📊 Distributing ${allLeads.length} leads: ~${leadsPerJournalist} per journalist`);
    
    // Create batches for each journalist
    const batches: any[] = [];
    
    for (let i = 0; i < journalists.length; i++) {
      const journalistId = journalists[i];
      const startIdx = i * leadsPerJournalist;
      const endIdx = Math.min(startIdx + leadsPerJournalist, allLeads.length);
      const journalistLeads = allLeads.slice(startIdx, endIdx);
      
      if (journalistLeads.length === 0) continue;
      
      const batch = writeBatch(firestore);
      
      console.log(`📌 ${journalistId} will process ${journalistLeads.length} leads (index ${startIdx} to ${endIdx-1}):`);
      
      // Add leads to journalist-specific collection
      journalistLeads.forEach((lead, idx) => {
        const newDocRef = doc(collection(firestore, `leads_${journalistId}`));
        const leadTitle = (lead as any).title || 'Untitled';
        batch.set(newDocRef, {
          ...lead,
          assignedTo: journalistId,
          assignedAt: Timestamp.now(),
          originalIndex: startIdx + idx // Track original position for debugging
        });
        console.log(`   → Lead ${startIdx + idx}: "${leadTitle.substring(0, 50)}..." (ID: ${lead.id})`);
      });
      
      batches.push({ batch, journalistId, count: journalistLeads.length });
    }
    
    // Commit all batches
    await Promise.all(batches.map(b => b.batch.commit()));
    
    console.log(`📊 Lead distribution complete:`);
    batches.forEach(b => {
      console.log(`   ${b.journalistId}: ${b.count} leads assigned`);
    });
    
    // Verify no overlap by checking total assigned equals original count
    const totalAssigned = batches.reduce((sum, b) => sum + b.count, 0);
    console.log(`✅ Verification: ${totalAssigned} leads assigned out of ${allLeads.length} total (${totalAssigned === allLeads.length ? 'MATCH ✓' : 'MISMATCH ✗'})`);
    
    if (totalAssigned !== allLeads.length) {
      console.error(`❌ ERROR: Lead distribution mismatch! Expected ${allLeads.length}, got ${totalAssigned}`);
      await updateQueueState({ currentStep: 'error', error: 'Lead distribution count mismatch' });
      return { success: false, message: 'Lead distribution failed', error: 'Count mismatch' };
    }
    
    // Clear the raw_leads collection
    const clearBatch = writeBatch(firestore);
    leadsSnapshot.docs.forEach(doc => clearBatch.delete(doc.ref));
    await clearBatch.commit();
    
    // Update UI for each journalist
    for (const { journalistId, count } of batches) {
      await updateAgentProgress(journalistId as any, 'idle', `Ready with ${count} leads`, { drafted: 0 });
    }
    
    await updateAgentProgress('journalist', 'working', `Leads distributed. Starting parallel drafting...`);
    await updateQueueState({ currentStep: 'journalists_parallel', draftsMade: 0 });
    
    console.log('✅ Step 3 COMPLETE: Leads distributed. Next step: Parallel journalist work');
    return { success: true, message: `Distributed ${allLeads.length} leads to 5 journalists`, nextStep: 'journalists_parallel' };
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Lead distribution failed', error: error.message };
  }
}

// Step 4: All journalists work in parallel
export async function executeStep4_JournalistsParallel(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('📋 Step 4: Running all 5 journalists in parallel');
    
    await updateWorkflowState({ status: 'running', message: 'Step 4: All 5 journalists drafting articles in parallel...' });
    
    await updateAgentProgress('journalist', 'working', 'All 5 journalists drafting articles...');
    
    const journalists = ['journalist_1', 'journalist_2', 'journalist_3', 'journalist_4', 'journalist_5'];
    
    // Start all journalists in parallel
    const journalistPromises = journalists.map(journalistId => 
      runJournalistFromAssignedLeads(journalistId)
    );
    
    // Wait for all to complete
    const results = await Promise.all(journalistPromises);
    
    // Calculate total articles drafted
    const totalDrafted = results.reduce((sum, result) => sum + result.drafted, 0);
    
    // Update aggregated journalist status
    await updateAgentProgress('journalist', 'success', `All journalists completed: ${totalDrafted} articles drafted`, { 
      drafted: totalDrafted, 
      remaining: 0 
    });
    
    // Deduplicate draft articles before validation
    console.log('🔍 Running article deduplication...');
    await updateAgentProgress('deduplicator', 'working', 'Checking for duplicate articles...');
    
    const { deduplicateDraftArticlesAction } = await import('@/app/actions-dedup-new');
    const dedupResult = await deduplicateDraftArticlesAction();
    
    if (dedupResult.success && dedupResult.deletedCount > 0) {
      console.log(`🗑️ Removed ${dedupResult.deletedCount} duplicate articles. ${dedupResult.totalArticles} unique articles remain.`);
      await updateAgentProgress('deduplicator', 'success', `Removed ${dedupResult.deletedCount} duplicate articles. ${dedupResult.totalArticles} unique remain.`);
    } else {
      console.log(`✅ No duplicate articles found. ${dedupResult.totalArticles} unique articles.`);
      await updateAgentProgress('deduplicator', 'success', `No duplicates found. ${dedupResult.totalArticles} articles ready.`);
    }
    
    await updateQueueState({ currentStep: 'validate', draftsMade: dedupResult.totalArticles });
    
    console.log(`✅ Step 4 COMPLETE: All journalists finished. Total articles: ${dedupResult.totalArticles}. Next step: Validation`);
    return { success: true, message: `All journalists completed. ${totalDrafted} articles drafted.`, nextStep: 'validate' };
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Parallel journalist work failed', error: error.message };
  }
}

// Run journalist process from their assigned leads collection
async function runJournalistFromAssignedLeads(journalistId: string): Promise<{ drafted: number }> {
  let drafted = 0;
  const processId = `${journalistId}_${Date.now()}`; // Unique process ID
  
  console.log(`📰 ${journalistId} starting parallel work... [Process ID: ${processId}]`);
  
  // Don't reset drafted count - just update status to 'working'
  await updateAgentProgress(journalistId as any, 'working', 'Drafting articles...');
  
  const { firestore } = await import('@/lib/firebase-server').then(m => m.getFirebaseServices());
  const { collection, getDocs, query, limit, writeBatch, doc, Timestamp, deleteDoc, where } = await import('firebase/firestore');
  
  try {
    // Process all leads from this journalist's collection
    let hasMoreLeads = true;
    
    while (hasMoreLeads) {
      // Get one lead from journalist's collection
      const leadsQuery = query(collection(firestore, `leads_${journalistId}`), limit(1));
      const leadsSnapshot = await getDocs(leadsQuery);
      
      if (leadsSnapshot.empty) {
        hasMoreLeads = false;
        break;
      }
      
      const leadDoc = leadsSnapshot.docs[0];
      const leadData = leadDoc.data();
      const lead = { 
        id: leadDoc.id, 
        url: leadData.url || '',
        title: leadData.title || '',
        topic: leadData.topic || '',
        content: leadData.content || '',
        imageUrl: leadData.imageUrl || '',
        category: leadData.category || 'National'
      };
      
      try {
        // Check if this lead was already processed (duplicate prevention)
        const existingDraftQuery = query(
          collection(firestore, 'draft_articles'),
          where('rawLeadId', '==', lead.id),
          limit(1)
        );
        const existingDraft = await getDocs(existingDraftQuery);
        
        if (!existingDraft.empty) {
          console.log(`⚠️ ${journalistId} [${processId}] skipping duplicate lead: ${lead.id}`);
          await deleteDoc(leadDoc.ref);
          continue;
        }
        
        console.log(`📝 ${journalistId} [${processId}] processing lead: ${lead.id} - "${lead.title.substring(0, 50)}..."`);
        
        // Generate article from lead
        const { summarizeBreakingNews } = await import('@/ai/flows/summarize-breaking-news');
        const summaryResult = await summarizeBreakingNews({ 
          url: lead.url, 
          title: lead.title, 
          topic: lead.topic, 
          content: lead.content,
          category: lead.category
        });
        
        // Create draft article
        const batch = writeBatch(firestore);
        
        const newDraftRef = doc(collection(firestore, 'draft_articles'));
        batch.set(newDraftRef, {
          rawLeadId: lead.id,
          headline: summaryResult.headline,
          content: summaryResult.summary,
          imageUrl: lead.imageUrl || '',
          status: 'drafted',
          createdBy: journalistId,
          createdAt: Timestamp.now(),
          category: summaryResult.category,
          kicker: summaryResult.kicker
        });
        
        // Delete the lead from journalist's collection
        batch.delete(leadDoc.ref);
        
        await batch.commit();
        
        drafted++;
        
        await updateAgentProgress(journalistId as any, 'working', `Drafted ${drafted} article${drafted > 1 ? 's' : ''}`, { 
          drafted 
        });
        
        console.log(`✅ ${journalistId} [${processId}] drafted article #${drafted}: ${summaryResult.headline.substring(0, 60)}...`);
        
        await sleep(200); // Brief pause between articles
        
      } catch (articleError: any) {
        console.error(`❌ ${journalistId} [${processId}] failed to draft article:`, articleError);
        // Delete the problematic lead and continue
        await deleteDoc(leadDoc.ref);
      }
    }
    
    await updateAgentProgress(journalistId as any, 'success', `Completed ${drafted} article${drafted !== 1 ? 's' : ''}`, { 
      drafted 
    });
    
    console.log(`✅ ${journalistId} [${processId}] completed with ${drafted} articles`);
    
    return { drafted };
    
  } catch (error: any) {
    console.error(`❌ ${journalistId} [${processId}] critical error:`, error);
    await updateAgentProgress(journalistId as any, 'idle', `Error: ${error.message}`, { drafted });
    return { drafted };
  }
}

// Step 5: Validate and Editor (completes in < 60s)
// Step 6: Editor 2 - Refine and expand layout
export async function executeStep6_Editor2(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string; completed?: boolean }> {
  try {
    console.log('📋 Step 6: Editor 2 (Refinement & Expansion)');
    
    await updateWorkflowState({ status: 'running', message: 'Step 6: Editor 2 refining and expanding layout...' });
    
    const state = await getQueueState();
    
    console.log('🔍 Editor 2: Checking queue state...');
    console.log('🔍 Editor 2: State keys:', state ? Object.keys(state) : 'null');
    console.log('🔍 Editor 2: initialHtml exists?', !!state?.initialHtml);
    console.log('🔍 Editor 2: initialHtml length:', state?.initialHtml?.length || 0);
    console.log('🔍 Editor 2: editionNumber:', state?.editionNumber);
    
    if (!state?.initialHtml) {
      console.error('❌ Editor 2: Missing initialHtml in queue state!');
      console.error('❌ Editor 2: Full state:', JSON.stringify(state, null, 2));
      
      // Move back to editor step to retry Editor 1
      await updateQueueState({ currentStep: 'editor', error: 'Missing HTML from Editor 1' });
      return { success: false, message: 'No initial HTML from Editor 1 - retrying Editor 1', error: 'Missing initial HTML', nextStep: 'editor' };
    }
    
    // Double-check we're not already complete
    if (state.currentStep === 'complete') {
      console.log('⚠️ Workflow already completed. Skipping Editor 2.');
      return { success: true, message: 'Edition already created', completed: true };
    }
    
    // Mark as complete BEFORE creating edition to prevent race conditions
    await updateQueueState({ currentStep: 'complete', validCount: state.validCount });
    
    await updateAgentProgress('editor', 'working', 'Editor 2: Refining layout and expanding content...');
    const editor2Result = await refineLayoutAction(state.initialHtml, state.editionNumber);
    
    if (!editor2Result.success) {
      await updateQueueState({ currentStep: 'error', error: editor2Result.error });
      return { success: false, message: 'Editor 2 failed', error: editor2Result.error };
    }
    
    await updateAgentProgress('editor', 'success', `Edition created: ${editor2Result.editionId}`);
    await updateWorkflowState({ status: 'success', message: 'Workflow completed successfully!' });
    
    // Reset all agents to idle
    console.log('🔄 Editor 2 complete - Resetting all agents to idle...');
    await updateAgentProgress('scout', 'idle', '');
    await updateAgentProgress('deduplicator', 'idle', '', { checked: 0, remaining: 0 });
    await updateAgentProgress('journalist', 'idle', '', { drafted: 0, remaining: 0 });
    await updateAgentProgress('journalist_1', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_2', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_3', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_4', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_5', 'idle', '', { drafted: 0 });
    await updateAgentProgress('validator', 'idle', '');
    await updateAgentProgress('editor', 'idle', '');
    await updateAgentProgress('publisher', 'idle', '');
    console.log('✅ All agents reset to idle - Ready for next workflow');
    
    console.log(`✅ Step 6 COMPLETE: Editor 2 finished. Workflow complete with ${state.validCount} articles!`);
    return { success: true, message: `Edition created with ${state.validCount} articles!`, completed: true };
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Editor 2 failed', error: error.message };
  }
}

export async function executeStep5_ValidateAndEditor1(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string; completed?: boolean }> {
  try {
    console.log('📋 Step 5: Validate and Editor 1 (Initial Layout)');
    
    await updateWorkflowState({ status: 'running', message: 'Step 5: Validating articles and creating initial layout...' });
    
    const state = await getQueueState();
    
    // Validate
    await updateAgentProgress('validator', 'working', 'Validating article quality...');
    const validationResult = await validateArticlesAction();
    
    if (!validationResult.success) {
      await updateQueueState({ currentStep: 'error', error: validationResult.error });
      return { success: false, message: 'Validation failed', error: validationResult.error };
    }
    
    await updateAgentProgress('validator', 'success', `Validator approved ${validationResult.validCount} articles, discarded ${validationResult.discardedCount}.`);
    
    // Check if we have enough articles (35+ for comprehensive edition)
    if (validationResult.validCount >= 35) {
      console.log(`✅ Validator complete: ${validationResult.validCount} articles validated`);
      
      // Create complete newspaper with single comprehensive editor
      await updateAgentProgress('editor', 'working', 'Editor: Creating comprehensive newspaper layout...');
      const editorResult = await createPreviewEditionAction();
      
      if (!editorResult.success) {
        await updateQueueState({ currentStep: 'error', error: editorResult.error });
        return { success: false, message: 'Editor failed', error: editorResult.error };
      }
      
      await updateAgentProgress('editor', 'success', `Edition created: ${editorResult.editionId}`);
      
      // Mark workflow as complete
      await updateQueueState({ currentStep: 'complete', validCount: validationResult.validCount });
      await updateWorkflowState({ status: 'success', message: 'Workflow completed successfully!' });
      
      // Reset all agents to idle
      console.log('🔄 Editor complete - Resetting all agents to idle...');
      await updateAgentProgress('scout', 'idle', '');
      await updateAgentProgress('deduplicator', 'idle', '', { checked: 0, remaining: 0 });
      await updateAgentProgress('journalist', 'idle', '', { drafted: 0, remaining: 0 });
      await updateAgentProgress('journalist_1', 'idle', '', { drafted: 0 });
      await updateAgentProgress('journalist_2', 'idle', '', { drafted: 0 });
      await updateAgentProgress('journalist_3', 'idle', '', { drafted: 0 });
      await updateAgentProgress('journalist_4', 'idle', '', { drafted: 0 });
      await updateAgentProgress('journalist_5', 'idle', '', { drafted: 0 });
      await updateAgentProgress('validator', 'idle', '');
      await updateAgentProgress('editor', 'idle', '');
      await updateAgentProgress('publisher', 'idle', '');
      console.log('✅ All agents reset to idle - Ready for next workflow');
      
      console.log(`✅ Step 5 COMPLETE: Editor finished with ${validationResult.validCount} articles. Workflow complete!`);
      return { success: true, message: `Edition created with ${validationResult.validCount} articles!`, completed: true };
      
    } else if ((state?.attempt || 1) < 3) {
      // Need more articles, retry from scout
      await updateAgentProgress('validator', 'working', `Need more articles (${validationResult.validCount}/35). Retrying scout...`);
      await updateQueueState({ 
        currentStep: 'clear_data', 
        attempt: (state?.attempt || 1) + 1,
        validCount: validationResult.validCount 
      });
      
      console.log(`⚠️ Only ${validationResult.validCount} articles. Retrying from Scout (attempt ${(state?.attempt || 1) + 1}/3)`);
      return { success: true, message: `Only ${validationResult.validCount} articles. Retrying (${(state?.attempt || 1) + 1}/3)...`, nextStep: 'clear_data' };
      
    } else {
      // Failed after 3 attempts
      const error = `Failed to get 35 articles after 3 attempts (got ${validationResult.validCount})`;
      await updateQueueState({ currentStep: 'error', error });
      await updateWorkflowState({ status: 'error', message: error });
      return { success: false, message: error, error };
    }
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Step 4 failed', error: error.message };
  }
}

// ========================================
// 3-PHASE CONSOLIDATED WORKFLOW FUNCTIONS
// ========================================

// PHASE 1: Scout + Dedup + Distribute Leads (< 5 minutes total)
export async function executePhase1_Preparation(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('🚀 ========== PHASE 1: PREPARATION ==========');
    await updateWorkflowState({ status: 'running', message: 'Phase 1: Scouting, deduplicating, and distributing leads...' });
    
    const state = await getQueueState();
    const attempt = state?.attempt || 1;
    
    // STEP 1: Clear data and scout
    console.log('📋 Phase 1 - Step 1: Clear data and scout');
    await updateAgentProgress('scout', 'working', 'Clearing previous data...');
    const clearResult = await clearAllDataAction();
    if (!clearResult.success) {
      await updateQueueState({ currentStep: 'error', error: clearResult.error });
      return { success: false, message: 'Failed to clear data', error: clearResult.error };
    }
    
    const leadsToFind = attempt === 1 ? 45 : 5;
    await updateAgentProgress('scout', 'working', `Scout is gathering news leads (Attempt ${attempt}/3)...`);
    const scoutResult = await findLeadsAction(leadsToFind);
    
    if (!scoutResult.success) {
      await updateQueueState({ currentStep: 'error', error: scoutResult.error });
      return { success: false, message: 'Scout failed', error: scoutResult.error };
    }
    
    await updateAgentProgress('scout', 'success', `Scout found ${scoutResult.leadCount} breaking news leads.`);
    console.log(`✅ Phase 1 - Scout complete: ${scoutResult.leadCount} leads found`);
    
    // STEP 2: Deduplication
    console.log('📋 Phase 1 - Step 2: Deduplication');
    await updateAgentProgress('deduplicator', 'working', 'AI Deduplicator is analyzing all leads...');
    const { deduplicateLeadsActionBatch } = await import('@/app/actions-dedup-new');
    const dedupResult = await deduplicateLeadsActionBatch();
    
    if (!dedupResult.success) {
      await updateQueueState({ currentStep: 'error', error: dedupResult.error });
      return { success: false, message: 'Deduplication failed', error: dedupResult.error };
    }
    
    await updateAgentProgress('deduplicator', 'success', `Removed ${dedupResult.deletedCount} duplicates. ${dedupResult.totalLeads} unique leads remain.`, { 
      deleted: dedupResult.deletedCount, 
      passed: dedupResult.totalLeads 
    });
    console.log(`✅ Phase 1 - Dedup complete: ${dedupResult.deletedCount} duplicates removed, ${dedupResult.totalLeads} leads remain`);
    
    // STEP 3: Distribute leads
    console.log('📋 Phase 1 - Step 3: Distribute leads to journalists');
    await updateAgentProgress('journalist', 'working', 'Distributing leads to 5 journalists...');
    
    const { firestore } = await import('@/lib/firebase-server').then(m => m.getFirebaseServices());
    const { collection, getDocs, writeBatch, doc: firestoreDoc, Timestamp } = await import('firebase/firestore');
    
    // Get all raw leads
    const leadsSnapshot = await getDocs(collection(firestore, 'raw_leads'));
    const allLeads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (allLeads.length === 0) {
      await updateQueueState({ currentStep: 'error', error: 'No leads to distribute' });
      return { success: false, message: 'No leads found to distribute', error: 'No leads available' };
    }
    
    // Divide leads equally among 5 journalists
    const journalists = ['journalist_1', 'journalist_2', 'journalist_3', 'journalist_4', 'journalist_5'];
    const leadsPerJournalist = Math.ceil(allLeads.length / journalists.length);
    
    console.log(`📊 Distributing ${allLeads.length} leads: ~${leadsPerJournalist} per journalist`);
    
    // Create batches for each journalist
    for (let i = 0; i < journalists.length; i++) {
      const journalistId = journalists[i];
      const startIdx = i * leadsPerJournalist;
      const endIdx = Math.min(startIdx + leadsPerJournalist, allLeads.length);
      const journalistLeads = allLeads.slice(startIdx, endIdx);
      
      if (journalistLeads.length === 0) continue;
      
      const batch = writeBatch(firestore);
      
      console.log(`📌 ${journalistId} will process ${journalistLeads.length} leads`);
      
      // Add leads to journalist-specific collection
      journalistLeads.forEach((lead: any) => {
        const newDocRef = firestoreDoc(collection(firestore, `leads_${journalistId}`));
        batch.set(newDocRef, {
          ...lead,
          assignedAt: Timestamp.now(),
          status: 'pending'
        });
      });
      
      await batch.commit();
    }
    
    await updateAgentProgress('journalist', 'success', `Distributed ${allLeads.length} leads to 5 journalists.`);
    console.log(`✅ Phase 1 - Distribution complete: ${allLeads.length} leads assigned`);
    
    // Move to Phase 2
    await updateQueueState({ currentStep: 'phase2_content' });
    console.log('🎉 ========== PHASE 1 COMPLETE ==========');
    return { success: true, message: `Phase 1 complete: ${allLeads.length} leads ready for journalists`, nextStep: 'phase2_content' };
    
  } catch (error: any) {
    console.error('❌ Phase 1 error:', error);
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Phase 1 failed', error: error.message };
  }
}

// PHASE 2: All Journalists + Sports Journalist + Validation (< 5 minutes total)
export async function executePhase2_ContentCreation(): Promise<{ success: boolean; message: string; error?: string; nextStep?: string }> {
  try {
    console.log('🚀 ========== PHASE 2: CONTENT CREATION ==========');
    await updateWorkflowState({ status: 'running', message: 'Phase 2: Creating articles and gathering sports data...' });
    
    // STEP 1: All 5 journalists work in parallel
    console.log('📋 Phase 2 - Step 1: 5 Journalists drafting articles');
    await updateAgentProgress('journalist', 'working', 'All journalists are drafting articles...');
    
    const journalistPromises = [1, 2, 3, 4, 5].map(async (journalistId) => {
      await updateAgentProgress(`journalist_${journalistId}` as any, 'working', `Journalist ${journalistId}: Writing articles...`, { drafted: 0 });
      
      for (let i = 0; i < 20; i++) {
        const draftResult = await draftArticleAction(journalistId);
        if (!draftResult.success) break;
        
        await updateAgentProgress(`journalist_${journalistId}` as any, 'working', `Journalist ${journalistId}: Drafted ${i + 1} articles...`, { drafted: i + 1 });
        
        if (draftResult.remaining === 0) {
          await updateAgentProgress(`journalist_${journalistId}` as any, 'success', `Journalist ${journalistId}: Completed all assignments.`, { drafted: i + 1 });
          break;
        }
      }
    });
    
    // STEP 2: Sports Journalist works in parallel
    console.log('📋 Phase 2 - Step 2: Sports Journalist gathering data');
    const { generateSportsDataAction } = await import("@/app/actions");
    
    const sportsPromise = (async () => {
      await updateAgentProgress('sports_journalist' as any, 'working', 'Sports Journalist: Gathering sports scores...');
      const sportsResult = await generateSportsDataAction();
      
      if (sportsResult.success) {
        await updateAgentProgress('sports_journalist' as any, 'success', `Sports Journalist: Collected ${sportsResult.boxCount} sports boxes.`);
        console.log(`✅ Phase 2 - Sports Journalist complete: ${sportsResult.boxCount} boxes`);
      } else {
        console.warn(`⚠️ Sports Journalist failed: ${sportsResult.error}`);
      }
      
      return sportsResult;
    })();
    
    // Wait for all journalists and sports journalist
    await Promise.all([...journalistPromises, sportsPromise]);
    
    await updateAgentProgress('journalist', 'success', 'All journalists have completed their articles.');
    console.log('✅ Phase 2 - All journalists complete');
    
    // STEP 3: Validation
    console.log('📋 Phase 2 - Step 3: Validating articles');
    await updateAgentProgress('validator', 'working', 'Validating article quality...');
    const validationResult = await validateArticlesAction();
    
    if (!validationResult.success) {
      await updateQueueState({ currentStep: 'error', error: validationResult.error });
      return { success: false, message: 'Validation failed', error: validationResult.error };
    }
    
    await updateAgentProgress('validator', 'success', `Validator approved ${validationResult.validCount} articles, discarded ${validationResult.discardedCount}.`);
    console.log(`✅ Phase 2 - Validation complete: ${validationResult.validCount} valid articles`);
    
    // Check if we have enough articles
    const state = await getQueueState();
    if (validationResult.validCount >= 35) {
      await updateQueueState({ currentStep: 'phase3_editor', validCount: validationResult.validCount });
      console.log('🎉 ========== PHASE 2 COMPLETE ==========');
      return { success: true, message: `Phase 2 complete: ${validationResult.validCount} articles ready for editor`, nextStep: 'phase3_editor' };
    } else if ((state?.attempt || 1) < 3) {
      // Need more articles, retry from phase 1
      await updateAgentProgress('validator', 'working', `Need more articles (${validationResult.validCount}/35). Retrying...`);
      await updateQueueState({ 
        currentStep: 'phase1_prep', 
        attempt: (state?.attempt || 1) + 1,
        validCount: validationResult.validCount 
      });
      return { success: true, message: `Only ${validationResult.validCount} articles. Retrying phase 1 (${(state?.attempt || 1) + 1}/3)...`, nextStep: 'phase1_prep' };
    } else {
      const error = `Failed to get 35 articles after 3 attempts (got ${validationResult.validCount})`;
      await updateQueueState({ currentStep: 'error', error });
      return { success: false, message: error, error };
    }
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Phase 2 failed', error: error.message };
  }
}

// PHASE 3: Editor creates complete newspaper (< 5 minutes)
export async function executePhase3_Editor(): Promise<{ success: boolean; message: string; error?: string; completed?: boolean }> {
  try {
    console.log('🚀 ========== PHASE 3: EDITOR ==========');
    await updateWorkflowState({ status: 'running', message: 'Phase 3: Editor creating comprehensive newspaper...' });
    
    const state = await getQueueState();
    
    await updateAgentProgress('editor', 'working', 'Editor: Creating comprehensive newspaper layout...');
    const editorResult = await createPreviewEditionAction();
    
    if (!editorResult.success) {
      await updateQueueState({ currentStep: 'error', error: editorResult.error });
      return { success: false, message: 'Editor failed', error: editorResult.error };
    }
    
    await updateAgentProgress('editor', 'success', `Edition created: ${editorResult.editionId}`);
    
    // Mark workflow as complete
    await updateQueueState({ currentStep: 'complete', validCount: state?.validCount || 0 });
    await updateWorkflowState({ status: 'success', message: 'Workflow completed successfully!' });
    
    // Reset all agents to idle
    console.log('🔄 Resetting all agents to idle...');
    await updateAgentProgress('scout', 'idle', '');
    await updateAgentProgress('deduplicator', 'idle', '', { checked: 0, remaining: 0 });
    await updateAgentProgress('journalist', 'idle', '', { drafted: 0, remaining: 0 });
    await updateAgentProgress('journalist_1', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_2', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_3', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_4', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_5', 'idle', '', { drafted: 0 });
    await updateAgentProgress('sports_journalist' as any, 'idle', '');
    await updateAgentProgress('validator', 'idle', '');
    await updateAgentProgress('editor', 'idle', '');
    await updateAgentProgress('publisher', 'idle', '');
    
    console.log('🎉 ========== PHASE 3 COMPLETE - WORKFLOW DONE ==========');
    return { success: true, message: `Edition created with ${state?.validCount || 0} articles!`, completed: true };
    
  } catch (error: any) {
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: 'Phase 3 failed', error: error.message };
  }
}

// Main orchestrator - executes ONE phase and returns
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
      console.log('⚠️ Workflow already complete. Preventing duplicate execution.');
      await clearQueueState();
      return { success: true, message: 'Workflow already completed', completed: true };
    }
    
    if (state.currentStep === 'error') {
      // Check if this is a force stop
      if (state.error === 'FORCE STOPPED BY USER') {
        console.log('🛑 FORCE STOP DETECTED - Aborting execution immediately');
        await clearQueueState();
        return { success: false, message: 'Workflow force stopped', completed: true, error: 'Force stopped by user' };
      }
      await updateWorkflowState({ status: 'error', message: state.error || 'Unknown error' });
      return { success: false, message: state.error || 'Unknown error', completed: true, error: state.error };
    }
    
    console.log(`🎯 ========================================`);
    console.log(`🎯 STARTING STEP: ${state.currentStep} (Attempt ${state.attempt || 1})`);
    console.log(`🎯 ========================================`);
    
    let result: any;
    
    switch (state.currentStep) {
      case 'phase1_prep':
        console.log('📋 Executing: Phase 1 - Preparation (Scout + Dedup + Distribute)');
        result = await executePhase1_Preparation();
        break;
        
      case 'phase2_content':
        console.log('📋 Executing: Phase 2 - Content Creation (Journalists + Sports + Validate)');
        result = await executePhase2_ContentCreation();
        break;
        
      case 'phase3_editor':
        console.log('📋 Executing: Phase 3 - Editor (Create Newspaper)');
        result = await executePhase3_Editor();
        result.completed = true;
        break;
        
      default:
        return { success: false, message: 'Unknown step', error: 'Unknown workflow step' };
    }
    
    console.log(`✅ STEP COMPLETED: ${state.currentStep}`);
    console.log(`📊 Result: success=${result.success}, nextStep=${result.nextStep || 'none'}, completed=${result.completed || false}`);
    console.log(`🎯 ========================================\n`);
    
    return result;
    
  } catch (error: any) {
    console.error('Workflow step execution error:', error);
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: error.message, error: error.message };
  }
}

// Start the workflow - Only initializes queue, execution varies by trigger
export async function startChainedWorkflow(isManualRun = false): Promise<{ success: boolean; message: string; error?: string }> {
  'use server';
  
  try {
    console.log(`🚀 Initializing chained workflow... (${isManualRun ? 'MANUAL' : 'CRON'} trigger)`);
    
    // STEP 1: RESET ALL AGENTS TO IDLE (FRESH START)
    console.log('🔄 Resetting all agent states to idle...');
    await updateAgentProgress('scout', 'idle', '');
    await updateAgentProgress('deduplicator', 'idle', '', { checked: 0, remaining: 0 });
    await updateAgentProgress('journalist', 'idle', '', { drafted: 0, remaining: 0 });
    await updateAgentProgress('journalist_1', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_2', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_3', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_4', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_5', 'idle', '', { drafted: 0 });
    await updateAgentProgress('sports_journalist' as any, 'idle', '');
    await updateAgentProgress('validator', 'idle', '');
    await updateAgentProgress('editor', 'idle', '');
    await updateAgentProgress('publisher', 'idle', '');
    console.log('✅ All agents reset to idle state');
    
    // Initialize workflow state with appropriate message
    const statusMessage = 'Workflow initialized. Cron will execute 3 phases...';
    
    await updateWorkflowState({ 
      status: 'running',
      message: statusMessage
    });
    
    // CRITICAL: Set initial queue state DIRECTLY (don't call clearQueueState first)
    // clearQueueState sets to 'idle' which causes cron to skip execution
    const { firestore } = await import('@/lib/firebase-server').then(m => m.getFirebaseServices());
    const { setDoc, doc, Timestamp } = await import('firebase/firestore');
    
    await setDoc(doc(firestore, 'workflow_queue', 'current'), {
      currentStep: 'phase1_prep' as any,
      isManualRun: false,  // Always false - cron handles everything
      attempt: 1,
      draftsMade: 0,
      validCount: 0,
      lastUpdated: Timestamp.now(),
      isExecuting: false,
      executionStartedAt: null as any
    });
    
    console.log('✅ Queue initialized to: phase1_prep');
    console.log('⏰ Vercel Cron will execute 3 phases (one per minute)');
    
    return { 
      success: true, 
      message: 'Workflow initialized. Cron will execute Phase 1 → 2 → 3.'
    };
    
  } catch (error: any) {
    console.error('❌ Error initializing workflow:', error);
    await updateWorkflowState({ status: 'error', message: error.message });
    await updateQueueState({ currentStep: 'error', error: error.message });
    return { success: false, message: error.message, error: error.message };
  }
}

// Stop the workflow immediately
export async function stopChainedWorkflow(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🛑 FORCE STOPPING WORKFLOW - IMMEDIATE ABORT');
    
    // STEP 1: Set to error state FIRST to abort any running operations
    await updateQueueState({ 
      currentStep: 'error', 
      error: 'FORCE STOPPED BY USER',
      isExecuting: false,
      executionStartedAt: null as any
    });
    
    // STEP 2: Reset workflow state to idle
    await updateWorkflowState({ status: 'idle', message: 'Workflow force stopped by user' });
    
    // STEP 3: Clear all agent progress immediately
    await updateAgentProgress('scout', 'idle', '');
    await updateAgentProgress('deduplicator', 'idle', '', { checked: 0, remaining: 0 });
    await updateAgentProgress('journalist', 'idle', '', { drafted: 0, remaining: 0 });
    await updateAgentProgress('journalist_1', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_2', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_3', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_4', 'idle', '', { drafted: 0 });
    await updateAgentProgress('journalist_5', 'idle', '', { drafted: 0 });
    await updateAgentProgress('sports_journalist' as any, 'idle', '');
    await updateAgentProgress('validator', 'idle', '');
    await updateAgentProgress('editor', 'idle', '');
    await updateAgentProgress('publisher', 'idle', '');
    
    // STEP 4: Finally clear queue to idle state
    await clearQueueState();
    
    console.log('✅ Workflow FORCE STOPPED. All operations aborted.');
    
    // Force revalidate to update UI immediately
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/admin');
    
    return { success: true, message: 'Workflow force stopped. All data preserved.' };
  } catch (error: any) {
    console.error('❌ Error stopping workflow:', error);
    return { success: false, message: `Failed to stop: ${error.message}` };
  }
}
