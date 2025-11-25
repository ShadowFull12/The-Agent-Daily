
'use server';

import {
    findLeadsAction,
    deduplicateLeadsAction,
    draftArticleAction,
    validateArticlesAction,
    createPreviewEditionAction,
    clearAllDataAction,
} from "@/app/actions";
import { initializeWorkflowState, updateWorkflowState, updateAgentProgress, clearWorkflowState, getWorkflowState } from "@/lib/workflow-state";
import { getFirebaseServices } from "@/lib/firebase-server";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global flag to track if workflow should stop
let shouldStopWorkflow = false;

export async function startWorkflowAction(isManualRun = false): Promise<{ success: boolean; message: string }> {
    try {
        console.log('🚀 Starting workflow action...');
        // Reset stop flag
        shouldStopWorkflow = false;
        
        // Initialize workflow state
        console.log('📋 Initializing workflow state...');
        await initializeWorkflowState();
        console.log('✅ Workflow state initialized');
        
        // In Vercel/serverless, we need to keep the function alive until work is done
        // We'll run the first critical steps synchronously, then let it continue
        const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
        
        if (isServerless) {
            console.log('🌐 Running in serverless mode - executing workflow synchronously');
            // Run synchronously to keep function alive
            await runWorkflowInBackground(isManualRun);
            return { success: true, message: 'Workflow completed' };
        } else {
            console.log('💻 Running in local mode - executing workflow in background');
            // Local development - run in background
            runWorkflowInBackground(isManualRun).catch(error => {
                console.error('❌ Background workflow error:', error);
                console.error('Error stack:', error.stack);
                updateWorkflowState({
                    status: 'error',
                    message: `Workflow failed: ${error.message}`
                }).catch(e => console.error('Failed to update error state:', e));
            });
            
            console.log('✅ Workflow started successfully');
            return { success: true, message: 'Workflow started successfully' };
        }
    } catch (error: any) {
        console.error('❌ Failed to start workflow:', error);
        console.error('Error stack:', error.stack);
        return { success: false, message: error.message };
    }
}

async function checkShouldStop(): Promise<boolean> {
    if (shouldStopWorkflow) return true;
    
    const state = await getWorkflowState();
    if (state?.status === 'stopping' || state?.status === 'idle') {
        shouldStopWorkflow = true;
        return true;
    }
    return false;
}

async function runWorkflowInBackground(isManualRun: boolean) {
    try {
        console.log('🔄 Running workflow in background...');
        
        // Clear existing data
        console.log('🧹 Clearing previous data...');
        await updateAgentProgress('scout', 'working', 'Clearing previous data...');
        
        const clearResult = await clearAllDataAction();
        if (!clearResult.success) {
            throw new Error(`Failed to clear data: ${clearResult.error}`);
        }
        console.log('✅ Previous data cleared successfully');
        await sleep(2000);

        if (await checkShouldStop()) throw new Error('Workflow stopped by user');

        let requiredArticlesMet = false;
        let attempt = 0;

        while (!requiredArticlesMet && attempt < 3) {
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            
            attempt++;
            console.log(`🔄 Starting attempt ${attempt}/3...`);
            
            // 1. Scout Agent
            console.log(`🔍 Scout Agent starting (Attempt ${attempt}/3)...`);
            await updateAgentProgress('scout', 'working', `Scout is gathering news leads (Attempt ${attempt}/3)...`);
            
            const scoutResult = await findLeadsAction();
            console.log('📊 Scout result:', scoutResult);
            
            if (!scoutResult.success) {
                const errorMsg = scoutResult.error || "Scout failed.";
                console.error('❌ Scout failed:', errorMsg);
                throw new Error(errorMsg);
            }
            
            console.log(`✅ Scout found ${scoutResult.leadCount} leads`);
            await updateAgentProgress('scout', 'success', `Scout found ${scoutResult.leadCount} leads.`);
            await sleep(5000);
            
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            await updateAgentProgress('scout', 'cooldown', '');

            // 2. Deduplicator Agent - NEW BATCH PROCESSING
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            await updateAgentProgress('deduplicator', 'working', 'AI Deduplicator is analyzing all leads in one batch...');
            
            const { deduplicateLeadsActionBatch } = await import('@/app/actions-dedup-new');
            const dedupResult = await deduplicateLeadsActionBatch();
            
            console.log('📊 Batch dedup result:', { 
                success: dedupResult.success, 
                deletedCount: dedupResult.deletedCount, 
                remaining: dedupResult.remaining,
                totalLeads: dedupResult.totalLeads
            });
            
            if (!dedupResult.success && dedupResult.error) {
                throw new Error(`Deduplication failed: ${dedupResult.error}`);
            }
            
            await updateAgentProgress('deduplicator', 'success', `AI checked all leads and removed ${dedupResult.deletedCount} duplicates in one batch.`, { checked: dedupResult.totalLeads, remaining: 0 });
            await sleep(2000); // Cooldown

            // 3. Journalist
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            
            await updateAgentProgress('journalist', 'working', 'Journalist is drafting articles...');
            let remaining = -1;
            let draftsMade = 0;
            
            do {
                if (await checkShouldStop()) throw new Error('Workflow stopped by user');
                
                const draftResult = await draftArticleAction();
                if (!draftResult.success && draftResult.error) {
                    console.warn("Drafting failed for one article:", draftResult.error);
                } else if (draftResult.articleId) {
                    draftsMade++;
                    await updateAgentProgress('journalist', 'working', `Journalist drafted ${draftsMade} articles. ${draftResult.remaining} leads left.`, { drafted: draftsMade, remaining: draftResult.remaining });
                }
                remaining = draftResult.remaining;
                if (remaining > 0) {
                    await sleep(2000);
                }
            } while (remaining > 0);
            
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            
            await updateAgentProgress('journalist', 'success', `Journalist drafted a total of ${draftsMade} articles.`, { drafted: draftsMade, remaining: 0 });
            await sleep(5000);
            await updateAgentProgress('journalist', 'cooldown', '', { drafted: 0, remaining: 0 });

            // 4. Validator
            if (await checkShouldStop()) throw new Error('Workflow stopped by user');
            
            await updateAgentProgress('validator', 'working', 'Validating article quality and count...');
            const validationResult = await validateArticlesAction();
            if (!validationResult.success) throw new Error(validationResult.error || "Validation failed.");
            
            await updateAgentProgress('validator', 'working', `Validator approved ${validationResult.validCount} articles, discarded ${validationResult.discardedCount}.`);
            
            if (validationResult.validCount >= 15) {
                requiredArticlesMet = true;
                await updateAgentProgress('validator', 'success', `Article count sufficient (${validationResult.validCount}). Proceeding to layout.`);
            } else {
                await updateAgentProgress('validator', 'error', `Article count (${validationResult.validCount}) is below 15. Rerunning scout...`);
                await sleep(5000);
            }
        }

        if (await checkShouldStop()) throw new Error('Workflow stopped by user');

        if (!requiredArticlesMet) {
            throw new Error("Failed to gather enough articles after 3 attempts.");
        }

        // 5. Editor
        if (await checkShouldStop()) throw new Error('Workflow stopped by user');
        await updateAgentProgress('editor', 'working', 'Chief Editor is designing the newspaper layout...');
        const editorResult = await createPreviewEditionAction();
        if (!editorResult.success) throw new Error(editorResult.error || "Editor failed.");
        
        await updateAgentProgress('editor', 'success', `Chief Editor created edition: ${editorResult.editionId}`);
        await sleep(5000);
        await updateAgentProgress('editor', 'cooldown', '');

        // Final check before success
        if (await checkShouldStop()) throw new Error('Workflow stopped by user');

        // Success
        await updateWorkflowState({
            status: 'success',
            message: 'Workflow completed successfully! Edition is ready for publication.',
        });

    } catch (error: any) {
        console.error('Workflow error:', error);
        
        // If stopped by user, clear all data and reset
        if (error.message.includes('stopped by user')) {
            await clearAllDataAction();
            await updateWorkflowState({
                status: 'idle',
                message: 'Workflow stopped and reverted by user',
            });
        } else {
            await updateWorkflowState({
                status: 'error',
                message: `Workflow failed: ${error.message}`,
            });
        }
    } finally {
        shouldStopWorkflow = false;
    }
}

export async function stopWorkflowAction(): Promise<{ success: boolean; message: string }> {
    try {
        await updateWorkflowState({
            status: 'stopping',
            message: 'Workflow stopping by user request...',
        });
        shouldStopWorkflow = true;
        console.log('🛑 Stop signal sent. Workflow will terminate shortly.');
        return { success: true, message: 'Workflow stop signal sent. It will terminate after the current task.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
