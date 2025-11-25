
"use server";
import 'dotenv/config';

import { searchBreakingNews } from "@/ai/flows/search-breaking-news";
import { summarizeBreakingNews } from "@/ai/flows/summarize-breaking-news";
import { generateNewspaperLayout } from "@/ai/flows/generate-newspaper-layout";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  limit,
  orderBy,
  writeBatch,
  getFirestore,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { RawLead, DraftArticle, Edition } from "@/lib/types";
import { getFirebaseServices } from "@/lib/firebase-server";

// 1. Scout Agent: Finds new leads
export async function findLeadsAction(limitStories: number = 25): Promise<{ success: boolean; leadCount: number; error?: string; }> {
  const { firestore } = getFirebaseServices();
  
  try {
    console.log('🔍 Scout Agent: Starting news search...');
    const topics = ["world", "technology", "business", "science", "politics", "entertainment", "sports"];
    console.log('📰 Scout Agent: Searching topics:', topics);
    
    const searchResult = await searchBreakingNews({ topics, limit: limitStories });
    console.log('📊 Scout Agent: Search completed. Stories found:', searchResult.stories?.length || 0);
    
    if (!searchResult.stories || searchResult.stories.length === 0) {
      console.log('⚠️ Scout Agent: No stories found');
      return { success: true, leadCount: 0 };
    }
    
    const stories = searchResult.stories.slice(0, limitStories);
    console.log(`💾 Scout Agent: Saving ${stories.length} stories to Firestore...`);

    const leadsCollection = collection(firestore, "raw_leads");
    const timestamp = Timestamp.now();
    
    // Process in batches of 10 for better performance
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < stories.length; i += batchSize) {
      const batch = writeBatch(firestore);
      const batchStories = stories.slice(i, i + batchSize);
      
      batchStories.forEach(story => {
        const newLeadRef = doc(leadsCollection);
        const leadData: Omit<RawLead, 'id'> = {
          topic: story.topic,
          url: story.url,
          imageUrl: story.imageUrl || '',
          createdAt: timestamp,
          title: story.title,
          content: story.content || '',
          status: 'pending',
          checked: false
        };
        batch.set(newLeadRef, leadData);
      });
      
      batches.push(batch.commit());
    }
    
    // Execute all batches in parallel
    await Promise.all(batches);
    console.log('✅ Scout Agent: Successfully saved all stories to Firestore');
    return { success: true, leadCount: stories.length };

  } catch (error: any) {
    console.error("❌ Scout Agent failed:", error);
    console.error("Error details:", error.message, error.stack);
    return { success: false, leadCount: 0, error: error.message };
  }
}

// 2. Deduplication Agent: AI-powered duplicate checker (processes one lead at a time)
export async function deduplicateLeadsAction(): Promise<{ success: boolean; deletedCount: number; remaining: number; totalLeads: number; checkedTitle?: string; error?: string; }> {
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
        
        if (leadsSnapshot.empty || leadsSnapshot.size === 1) {
            console.log(`✅ Dedup: Skipping - only ${leadsSnapshot.size} unchecked lead(s) remaining`);
            return { success: true, deletedCount: 0, remaining: leadsSnapshot.size, totalLeads };
        }

        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawLead));
        
        // Pick the first lead to check
        const currentLead = leads[0];
        const otherLeads = leads.slice(1);
        
        // Use AI to check if current lead is duplicate of any other lead
        const { checkDuplicate } = await import('@/ai/flows/check-duplicate');
        
        let isDuplicate = false;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        for (const otherLead of otherLeads) {
            try {
                // Add timeout to prevent hanging
                const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('AI check timeout')), 15000)
                );
                
                const checkPromise = checkDuplicate({
                    title1: currentLead.title,
                    title2: otherLead.title,
                });
                
                const result = await Promise.race([checkPromise, timeoutPromise]);
                
                if (result.isDuplicate) {
                    isDuplicate = true;
                    break;
                }
                
                retryCount = 0; // Reset retry count on success
                
            } catch (error: any) {
                console.error('Deduplication check error:', error.message);
                
                // If timeout or error, retry up to MAX_RETRIES times
                if (error.message?.includes('timeout') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) {
                        console.log('Max retries reached, skipping this comparison');
                        continue; // Skip this comparison and move to next
                    }
                    console.log(`Retry ${retryCount}/${MAX_RETRIES}, waiting 3 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue; // Don't break, just skip this iteration
                }
            }
        }
        
        if (isDuplicate) {
            // Delete the current lead (keep the other one)
            await deleteDoc(doc(firestore, "raw_leads", currentLead.id));
            
            // Get remaining count
            const remainingSnapshot = await getDocs(collection(firestore, "raw_leads"));
            return { 
                success: true, 
                deletedCount: 1, 
                remaining: remainingSnapshot.size,
                totalLeads,
                checkedTitle: currentLead.title
            };
        }
        
        // If not a duplicate, mark it as checked by adding a field
        await updateDoc(doc(firestore, "raw_leads", currentLead.id), {
            checked: true,
            checkedAt: new Date().toISOString()
        });
        
        // Get remaining count (only unchecked leads)
        const remainingSnapshot = await getDocs(
            query(collection(firestore, "raw_leads"), where("checked", "==", false))
        );
        
        return { 
            success: true, 
            deletedCount: 0, 
            remaining: remainingSnapshot.size,
            totalLeads,
            checkedTitle: currentLead.title
        };
        
    } catch (error: any) {
        console.error("deduplicateLeadsAction failed:", error);
        // Get remaining count even on error
        try {
            const remainingSnapshot = await getDocs(collection(firestore, "raw_leads"));
            return { success: false, deletedCount: 0, remaining: remainingSnapshot.size, totalLeads: remainingSnapshot.size, error: error.message };
        } catch (countError: any) {
            return { success: false, deletedCount: 0, remaining: 0, totalLeads: 0, error: error.message };
        }
    }
}


// 3. Journalist Agent: Drafts a single article (REWRITTEN FROM SCRATCH)
export async function draftArticleAction(): Promise<{ success: boolean; articleId?: string; headline?: string; error?: string; remaining: number }> {
    const { firestore } = getFirebaseServices();
    try {
        // 1. Fetch leads from the database without status filter to avoid index requirement
        const leadsQuery = query(collection(firestore, "raw_leads"), limit(10));
        const leadsSnapshot = await getDocs(leadsQuery);
        
        if (leadsSnapshot.empty) {
             return { success: true, remaining: 0 }; // No more leads to process
        }

        // Sort in memory to get the oldest one
        const sortedDocs = leadsSnapshot.docs.sort((a, b) => {
            const aTime = a.data().createdAt?.toMillis() || 0;
            const bTime = b.data().createdAt?.toMillis() || 0;
            return aTime - bTime;
        });
        
        const leadDoc = sortedDocs[0];
        const lead = { id: leadDoc.id, ...leadDoc.data() } as RawLead;

        // 2. Use the lead as input to generate the article.
        const summaryResult = await summarizeBreakingNews({ url: lead.url, title: lead.title, topic: lead.topic, content: lead.content });
        
        const draft: Omit<DraftArticle, 'id'|'createdAt'> = {
            rawLeadId: lead.id,
            headline: summaryResult.headline,
            content: summaryResult.summary,
            imageUrl: lead.imageUrl || '',
            status: 'drafted',
        };
        
        // 3. Use a batch to ensure atomicity (draft created + lead deleted)
        const batch = writeBatch(firestore);
        
        const newDraftRef = doc(collection(firestore, "draft_articles"));
        batch.set(newDraftRef, { ...draft, createdAt: Timestamp.now() });
        
        // 4. IMPORTANT: Delete the lead that was just processed.
        batch.delete(doc(firestore, "raw_leads", lead.id));
        
        await batch.commit();
        
        // 5. Correctly get the count of remaining leads for the UI *after* deletion.
        const remainingQuery = query(collection(firestore, "raw_leads"));
        const remainingSnapshot = await getDocs(remainingQuery);

        return { 
            success: true, 
            articleId: newDraftRef.id,
            headline: summaryResult.headline,
            remaining: remainingSnapshot.size,
        };
    } catch (error: any) {
        console.error("--- DRAFT ARTICLE ACTION FAILED ---", error);
        // Attempt to get a remaining count even if the action failed, for UI consistency
        try {
            const remainingQuery = query(collection(firestore, "raw_leads"));
            const remainingSnapshot = await getDocs(remainingQuery);
            return { success: false, error: error.message, remaining: remainingSnapshot.size };
        } catch (countError: any) {
            return { success: false, error: error.message, remaining: 0 };
        }
    }
}


// 4. Validation Agent: Checks drafts for quality
export async function validateArticlesAction(): Promise<{ success: boolean; validCount: number; discardedCount: number; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        const draftsSnapshot = await getDocs(query(collection(firestore, "draft_articles"), where("status", "==", "drafted")));
        
        const articlesToValidate = draftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DraftArticle));
        
        const batch = writeBatch(firestore);
        let discardedCount = 0;

        articlesToValidate.forEach(article => {
            const isValid = article.headline && article.headline.trim() !== '' && article.content && article.content.length > 50 && !article.headline.toLowerCase().includes('could not generate');
            if (isValid) {
                batch.update(doc(firestore, "draft_articles", article.id), { status: 'validated' });
            } else {
                batch.delete(doc(firestore, "draft_articles", article.id));
                discardedCount++;
            }
        });

        await batch.commit();
        
        const validSnapshot = await getDocs(query(collection(firestore, "draft_articles"), where("status", "==", "validated")));

        return { success: true, validCount: validSnapshot.size, discardedCount };
    } catch (error: any) {
        console.error("validateArticlesAction failed:", error);
        return { success: false, validCount: 0, discardedCount: 0, error: error.message };
    }
}


// 5. Chief Editor Agent: Creates the newspaper preview
export async function createPreviewEditionAction(): Promise<{ success: boolean; editionId?: string; error?: string }> {
    const { firestore } = getFirebaseServices();

    try {
        // Fetch validated articles without composite index requirement
        const draftsSnapshot = await getDocs(query(collection(firestore, "draft_articles"), where("status", "==", "validated")));
        const articles = draftsSnapshot.docs
            .map(doc => ({...doc.data(), id: doc.id})) as DraftArticle[];
        
        // Sort in memory by createdAt descending
        articles.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        if (articles.length === 0) {
            return { success: false, error: "No valid articles to create an edition." };
        }

        const editionsQuery = query(collection(firestore, "newspaper_editions"), orderBy("editionNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(editionsQuery);
        let newEditionNumber = 1;
        if (!querySnapshot.empty) {
            newEditionNumber = querySnapshot.docs[0].data().editionNumber + 1;
        }

        const layout = await generateNewspaperLayout({ articles, editionNumber: newEditionNumber });

        const mainArticle = articles[0];
        const coverImageUrl = mainArticle.imageUrl || `https://picsum.photos/seed/${newEditionNumber}/800/500`;

        const editionData: Omit<Edition, 'id'> = {
            editionNumber: newEditionNumber,
            publicationDate: Timestamp.now(),
            htmlContent: layout.html, 
            coverImageUrl: coverImageUrl,
            headline: mainArticle.headline,
            isPublished: false, 
        };

        const newEditionRef = await addDoc(collection(firestore, "newspaper_editions"), editionData);
        
        // Mark drafts as 'published' instead of deleting them, to keep a record
        const batch = writeBatch(firestore);
        draftsSnapshot.forEach(doc => {
            batch.update(doc.ref, { status: 'published' });
        });
        await batch.commit();

        return { success: true, editionId: newEditionRef.id };
    } catch (error: any) {
        const errorMessage = `Failed to create preview edition: ${error.message}`;
        console.error("createPreviewEditionAction failed:", error);
        return { success: false, error: errorMessage };
    }
}

// 6. Publisher Agent: Publishes the latest edition at the scheduled time
export async function publishLatestEditionAction(): Promise<{ success: boolean; error?: string; message?: string }> {
  const { firestore } = getFirebaseServices();
  try {
    const q = query(
      collection(firestore, "newspaper_editions"), 
      where("isPublished", "==", false),
      orderBy("publicationDate", "desc"), 
      limit(1) 
    );
    const snapshot = await getDocs(q);
    
    if(snapshot.empty) {
      return { success: false, error: "No unpublished edition found to publish." };
    }

    const editionToPublish = snapshot.docs[0];
   
    await updateDoc(doc(firestore, "newspaper_editions", editionToPublish.id), {
      isPublished: true,
      publicationDate: Timestamp.now(), // Update publication date to the moment it goes live
    });
    
    return { success: true, message: `Edition #${editionToPublish.data().editionNumber} has been published.` };
  } catch (error: any) {
    const errorMessage = `Failed to publish latest edition: ${error.message}`;
    console.error("publishLatestEditionAction failed:", error);
    return { success: false, error: errorMessage };
  }
}

// --- Advanced Manual Actions ---

async function clearCollection(collectionName: string): Promise<number> {
    const { firestore } = getFirebaseServices();
    const batch = writeBatch(firestore);
    const snapshot = await getDocs(collection(firestore, collectionName));
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return snapshot.size;
}

export async function clearRawLeadsAction(): Promise<{ success: boolean; count: number; error?: string; }> {
    try {
        const count = await clearCollection("raw_leads");
        return { success: true, count };
    } catch (error: any) {
        return { success: false, count: 0, error: error.message };
    }
}

export async function clearDraftArticlesAction(): Promise<{ success: boolean; count: number; error?: string; }> {
    try {
        const count = await clearCollection("draft_articles");
        return { success: true, count };
    } catch (error: any) {
        return { success: false, count: 0, error: error.message };
    }
}

export async function deleteRawLeadAction(id: string): Promise<{ success: boolean; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        await deleteDoc(doc(firestore, "raw_leads", id));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDraftArticleAction(id: string): Promise<{ success: boolean; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        await deleteDoc(doc(firestore, "draft_articles", id));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


// Check if there are existing draft articles in the database
export async function checkExistingDraftsAction(): Promise<{ success: boolean; draftCount: number; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        const draftsSnapshot = await getDocs(collection(firestore, "draft_articles"));
        return { success: true, draftCount: draftsSnapshot.size };
    } catch (error: any) {
        console.error("checkExistingDraftsAction failed:", error);
        return { success: false, draftCount: 0, error: error.message };
    }
}


// Utility action to clear all data for a fresh run
export async function clearAllDataAction(): Promise<{ success: boolean; error?: string; }> {
    const { firestore } = getFirebaseServices();
    const batch = writeBatch(firestore);

    try {
        const collections = ["raw_leads", "draft_articles"];
        for (const colName of collections) {
            const snapshot = await getDocs(collection(firestore, colName));
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
        }

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("clearAllDataAction failed:", error);
        return { success: false, error: error.message };
    }
}

    