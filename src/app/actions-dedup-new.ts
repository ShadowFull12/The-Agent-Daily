'use server';

import { getFirebaseServices } from "@/lib/firebase-server";
import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import type { RawLead } from "@/lib/types";

// New batch deduplication function
export async function deduplicateLeadsActionBatch(): Promise<{ success: boolean; deletedCount: number; remaining: number; totalLeads: number; checkedTitle?: string; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        // Fetch only unchecked leads
        const leadsQuery = query(
            collection(firestore, "raw_leads"),
            where("checked", "==", false)
        );
        const leadsSnapshot = await getDocs(leadsQuery);
        
        // Get total leads (including checked ones) for progress tracking
        const totalLeadsSnapshot = await getDocs(collection(firestore, "raw_leads"));
        const totalLeads = totalLeadsSnapshot.size;
        
        console.log(`🔍 Dedup: Found ${leadsSnapshot.size} unchecked leads out of ${totalLeads} total`);
        
        if (leadsSnapshot.empty) {
            console.log(`✅ Dedup: No unchecked leads remaining`);
            return { success: true, deletedCount: 0, remaining: 0, totalLeads };
        }

        const leads = leadsSnapshot.docs.map((doc, index) => ({ 
            id: doc.id, 
            index: index + 1,
            ...doc.data() 
        } as RawLead & { index: number }));
        
        // Build a prompt with all leads numbered
        const leadsList = leads.map((lead, idx) => 
            `${idx + 1}. "${lead.title}"`
        ).join('\n');
        
        const prompt = `You are an expert news editor. Below is a list of ${leads.length} news article titles. Identify which titles are reporting essentially the same story (duplicates).

**Rules:**
1. Compare all titles and find duplicates
2. If titles are about the same event/story, they are duplicates
3. Different aspects of the same story are still duplicates
4. Return ONLY the numbers of duplicate articles to DELETE (keep the first occurrence, remove subsequent ones)

**Article Titles:**
${leadsList}

**Output Format:**
Return ONLY a JSON array of numbers representing duplicate articles to DELETE. For example: [3, 7, 12]
If no duplicates found, return: []

Do NOT include markdown, explanations, or any other text. ONLY return the JSON array.`;

        console.log('🤖 Calling AI to check all leads for duplicates in one batch...');
        
        const { callKimi } = await import('@/lib/openrouter');
        const response = await callKimi(prompt, 'You are a professional news editor. Respond with ONLY a JSON array of numbers, no other text.');
        
        // Clean and parse response
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        console.log('📊 AI Response:', cleanResponse);
        
        const duplicateIndices: number[] = JSON.parse(cleanResponse);
        console.log(`🎯 AI identified ${duplicateIndices.length} duplicates:`, duplicateIndices);
        
        // Delete the duplicate leads
        let deletedCount = 0;
        if (duplicateIndices.length > 0) {
            const batch = writeBatch(firestore);
            
            for (const index of duplicateIndices) {
                // Find the lead with this index (1-based)
                const leadToDelete = leads.find(l => l.index === index);
                if (leadToDelete) {
                    console.log(`🗑️ Deleting duplicate #${index}: "${leadToDelete.title.substring(0, 50)}"`);
                    batch.delete(doc(firestore, "raw_leads", leadToDelete.id));
                    deletedCount++;
                }
            }
            
            await batch.commit();
            console.log(`✅ Deleted ${deletedCount} duplicates in batch`);
        }
        
        // Mark all remaining leads as checked
        const remainingLeads = leads.filter(l => !duplicateIndices.includes(l.index));
        if (remainingLeads.length > 0) {
            const checkBatch = writeBatch(firestore);
            const timestamp = new Date().toISOString();
            
            for (const lead of remainingLeads) {
                checkBatch.update(doc(firestore, "raw_leads", lead.id), {
                    checked: true,
                    checkedAt: timestamp
                });
            }
            
            await checkBatch.commit();
            console.log(`✅ Marked ${remainingLeads.length} leads as checked`);
        }
        
        // Get final count
        const finalSnapshot = await getDocs(collection(firestore, "raw_leads"));
        
        return { 
            success: true, 
            deletedCount, 
            remaining: 0, // All done in one shot
            totalLeads: finalSnapshot.size,
            checkedTitle: `Batch processed ${leads.length} leads, deleted ${deletedCount} duplicates`
        };
        
    } catch (error: any) {
        console.error("deduplicateLeadsActionBatch failed:", error);
        return { success: false, deletedCount: 0, remaining: 0, totalLeads: 0, error: error.message };
    }
}
