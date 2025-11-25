'use server';

import {
    findLeadsAction,
    deduplicateLeadsAction,
    draftArticleAction,
    validateArticlesAction,
    createPreviewEditionAction,
    clearAllDataAction,
} from "@/app/actions";
import { initializeWorkflowState, updateWorkflowState, updateAgentProgress, clearWorkflowState } from "@/lib/workflow-state";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function startWorkflowAction(isManualRun = false): Promise<{ success: boolean; message: string }> {
    try {
        // Initialize workflow state
        await initializeWorkflowState();
        
        // Run the workflow asynchronously (don't wait for it)
        runWorkflowInBackground(isManualRun).catch(error => {
            console.error('Background workflow error:', error);
            updateWorkflowState({
                status: 'error',
                message: `Workflow failed: ${error.message}`
            });
        });
        
        return { success: true, message: 'Workflow started successfully' };
    } catch (error: any) {
        console.error('Failed to start workflow:', error);
        return { success: false, message: error.message };
    }
}

async function runWorkflowInBackground(isManualRun: boolean) {
    try {
        // Clear existing data
        await updateAgentProgress('scout', 'working', 'Clearing previous data...');
        await clearAllDataAction();
        await sleep(2000);

        let requiredArticlesMet = false;
        let attempt = 0;

        while (!requiredArticlesMet && attempt < 3) {
            attempt++;
            
            // 1. Scout Agent
            await updateAgentProgress('scout', 'working', `Scout is gathering news leads (Attempt ${attempt}/3)...`);
            const scoutResult = await findLeadsAction();
            if (!scoutResult.success) throw new Error(scoutResult.error || "Scout failed.");
            await updateAgentProgress('scout', 'success', `Scout found ${scoutResult.leadCount} leads.`);
            await sleep(5000);
            await updateAgentProgress('scout', 'cooldown', '');

            // 2. Deduplicator Agent
            await updateAgentProgress('deduplicator', 'working', 'AI Deduplicator is scanning for duplicates...');
            let dedupRemaining = -1;
            let dedupChecks = 0;
            let totalDeleted = 0;
            let totalLeads = 0;
            
            do {
                const dedupResult = await deduplicateLeadsAction();
                
                if (dedupResult.totalLeads) {
                    totalLeads = dedupResult.totalLeads;
                }
                
                if (!dedupResult.success && dedupResult.error) {
                    console.warn("Deduplication failed for one lead:", dedupResult.error);
                    if (dedupResult.error.includes('quota') || dedupResult.error.includes('rate limit')) {
                        await updateAgentProgress('deduplicator', 'working', 'Rate limited. Waiting 5 seconds...', { checked: dedupChecks, remaining: dedupRemaining });
                        await sleep(5000);
                        continue;
                    }
                    break;
                }
                
                dedupChecks++;
                totalDeleted += dedupResult.deletedCount;
                dedupRemaining = dedupResult.remaining;
                
                if (dedupResult.checkedTitle) {
                    const status = dedupResult.deletedCount > 0 ? "duplicate found!" : "unique";
                    const checkedCount = totalLeads - dedupRemaining;
                    await updateAgentProgress('deduplicator', 'working', `Checked ${checkedCount} of ${totalLeads} - "${dedupResult.checkedTitle.substring(0, 40)}..." ${status}`, { checked: checkedCount, remaining: dedupRemaining });
                }
                
                if (dedupRemaining > 0) {
                    await sleep(1500);
                }
            } while (dedupRemaining > 1);
            
            await updateAgentProgress('deduplicator', 'success', `AI checked ${dedupChecks} leads and removed ${totalDeleted} duplicates.`, { checked: dedupChecks, remaining: 0 });
            await sleep(5000);
            await updateAgentProgress('deduplicator', 'cooldown', '', { checked: 0, remaining: 0 });

            // 3. Journalist
            await updateAgentProgress('journalist', 'working', 'Journalist is drafting articles...');
            let remaining = -1;
            let draftsMade = 0;
            
            do {
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
            
            await updateAgentProgress('journalist', 'success', `Journalist drafted a total of ${draftsMade} articles.`, { drafted: draftsMade, remaining: 0 });
            await sleep(5000);
            await updateAgentProgress('journalist', 'cooldown', '', { drafted: 0, remaining: 0 });

            // 4. Validator
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

        if (!requiredArticlesMet) {
            throw new Error("Failed to gather enough articles after 3 attempts.");
        }

        // 5. Editor
        await updateAgentProgress('editor', 'working', 'Chief Editor is designing the newspaper layout...');
        const editorResult = await createPreviewEditionAction();
        if (!editorResult.success) throw new Error(editorResult.error || "Editor failed.");
        
        await updateAgentProgress('editor', 'success', `Chief Editor created edition: ${editorResult.editionId}`);
        await sleep(5000);
        await updateAgentProgress('editor', 'cooldown', '');

        // Success
        await updateWorkflowState({
            status: 'success',
            message: 'Workflow completed successfully! Edition is ready for publication.',
        });

    } catch (error: any) {
        console.error('Workflow error:', error);
        await updateWorkflowState({
            status: 'error',
            message: `Workflow failed: ${error.message}`,
        });
    }
}

export async function stopWorkflowAction(): Promise<{ success: boolean; message: string }> {
    try {
        await updateWorkflowState({
            status: 'stopping',
            message: 'Workflow stop requested...',
        });
        return { success: true, message: 'Workflow will stop after current step' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
