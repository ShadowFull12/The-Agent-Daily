
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

// Helper function to map topics to newspaper categories
function categorizeStory(topic: string): string {
  const categoryMap: Record<string, string> = {
    'india': 'National',        // Indian news → National page
    'world': 'International',   // World news → International page
    'technology': 'Technology',
    'business': 'Business',
    'science': 'Science',
    'politics': 'Politics',
    'entertainment': 'Culture',
    'sports': 'Sports',
    'health': 'Healthcare',
    'environment': 'Environment',
    'top': 'National'
  };
  return categoryMap[topic.toLowerCase()] || 'National';
}

// 1. Scout Agent: Finds new leads
export async function findLeadsAction(limitStories: number = 25): Promise<{ success: boolean; leadCount: number; error?: string; }> {
  const { firestore } = getFirebaseServices();
  const { withTimeout } = await import('@/lib/firebase-server');
  
  try {
    console.log('🔍 Scout Agent: Starting news search...');
    // IMPORTANT: Search India-specific topics first to ensure National page has Indian content
    // Then add international and other topics
    const topics = [
      "india",           // Indian domestic news for National page
      "world",           // International news
      "technology", 
      "business", 
      "science", 
      "politics",        // Will include both Indian and international politics
      "entertainment", 
      "sports", 
      "health", 
      "environment"
    ];
    console.log('📰 Scout Agent: Searching topics (India-first for National page):', topics);
    
    const searchResult = await withTimeout(
      searchBreakingNews({ topics, limit: limitStories }),
      45000,
      'News search'
    );
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
          checked: false,
          category: categorizeStory(story.topic) // Add category based on topic
        };
        batch.set(newLeadRef, leadData);
      });
      
      batches.push(batch.commit());
    }
    
    // Execute all batches in parallel with timeout
    await withTimeout(
      Promise.all(batches),
      30000,
      'Firestore batch write'
    );
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
        // Only compare against a sample of other leads (not all) for performance
        const otherLeads = leads.slice(1, Math.min(6, leads.length)); // Check against max 5 others
        
        console.log(`🔍 Checking "${currentLead.title.substring(0, 40)}" against ${otherLeads.length} other leads`);
        
        // Use AI to check if current lead is duplicate of any other lead
        const { checkDuplicate } = await import('@/ai/flows/check-duplicate');
        
        let isDuplicate = false;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        for (const otherLead of otherLeads) {
            if (isDuplicate) break; // Stop checking once we find a duplicate
            
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
                    console.log(`🔍 Found duplicate: "${currentLead.title.substring(0, 40)}" matches "${otherLead.title.substring(0, 40)}"`);
                    break; // Stop checking, we found a duplicate
                }
                
                retryCount = 0; // Reset retry count on success
                
            } catch (error: any) {
                console.error('Deduplication check error:', error.message);
                
                // If timeout or error, retry up to MAX_RETRIES times
                if (error.message?.includes('timeout') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) {
                        console.log('Max retries reached, skipping this comparison');
                        retryCount = 0; // Reset for next comparison
                        continue; // Skip this comparison and move to next
                    }
                    console.log(`Retry ${retryCount}/${MAX_RETRIES}, waiting 3 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    // Retry same comparison by decrementing loop (but we can't in for-of, so just continue)
                    continue;
                }
                // For other errors, just continue to next comparison
                console.log('Non-retryable error, moving to next comparison');
            }
        }
        
        console.log(`🎯 For loop completed! isDuplicate=${isDuplicate}, checked ${otherLeads.length} other leads`);
        
        if (isDuplicate) {
            // Delete the current lead (keep the other one)
            console.log(`🗑️ Deleting duplicate lead: "${currentLead.title.substring(0, 40)}"`);
            await deleteDoc(doc(firestore, "raw_leads", currentLead.id));
            
            // Get remaining count
            console.log('📊 Getting remaining count after deletion...');
            const remainingSnapshot = await getDocs(collection(firestore, "raw_leads"));
            
            console.log(`✅ Deleted duplicate, ${remainingSnapshot.size} leads remaining`);
            return { 
                success: true, 
                deletedCount: 1, 
                remaining: remainingSnapshot.size,
                totalLeads,
                checkedTitle: currentLead.title
            };
        }
        
        // If not a duplicate, mark it as checked by adding a field
        console.log(`✅ Lead is unique, marking as checked: "${currentLead.title.substring(0, 40)}"`);
        console.log('📝 Updating Firestore document...');
        await updateDoc(doc(firestore, "raw_leads", currentLead.id), {
            checked: true,
            checkedAt: new Date().toISOString()
        });
        
        // Get remaining count (only unchecked leads)
        console.log('📊 Querying for remaining unchecked leads...');
        const remainingSnapshot = await getDocs(
            query(collection(firestore, "raw_leads"), where("checked", "==", false))
        );
        
        console.log(`✅ Marked as checked, ${remainingSnapshot.size} unchecked leads remaining`);
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
export async function draftArticleAction(journalistId?: string): Promise<{ success: boolean; articleId?: string; headline?: string; error?: string; remaining: number; journalistId?: string }> {
    const { firestore } = getFirebaseServices();
    try {
        // 1. Fetch leads (we'll filter in memory for unprocessed ones)
        const leadsQuery = query(
            collection(firestore, "raw_leads"),
            limit(20)
        );
        const leadsSnapshot = await getDocs(leadsQuery);
        
        if (leadsSnapshot.empty) {
             return { success: true, remaining: 0, journalistId }; // No more leads to process
        }

        // Filter for leads that are not being processed and sort by oldest
        const unprocessedDocs = leadsSnapshot.docs
            .filter(doc => !doc.data().processingBy)
            .sort((a, b) => {
                const aTime = a.data().createdAt?.toMillis() || 0;
                const bTime = b.data().createdAt?.toMillis() || 0;
                return aTime - bTime;
            });
        
        if (unprocessedDocs.length === 0) {
            return { success: true, remaining: 0, journalistId }; // No unprocessed leads
        }
        
        const leadDoc = unprocessedDocs[0];
        const lead = { id: leadDoc.id, ...leadDoc.data() } as RawLead;
        
        // 2. Lock this lead by marking it as being processed
        await updateDoc(doc(firestore, "raw_leads", lead.id), {
            processingBy: journalistId || 'journalist',
            processingAt: Timestamp.now()
        });

        // 2. Use the lead as input to generate the article.
        // 3. Use the lead as input to generate the article.
        const summaryResult = await summarizeBreakingNews({ url: lead.url, title: lead.title, topic: lead.topic, content: lead.content });
        
        const draft: Omit<DraftArticle, 'id'|'createdAt'> = {
            rawLeadId: lead.id,
            headline: summaryResult.headline,
            content: summaryResult.summary,
            imageUrl: lead.imageUrl || '',
            status: 'drafted',
        };
        
        // 4. Use a batch to ensure atomicity (draft created + lead deleted)
        const batch = writeBatch(firestore);
        
        const newDraftRef = doc(collection(firestore, "draft_articles"));
        batch.set(newDraftRef, { ...draft, createdAt: Timestamp.now() });
        
        // 5. IMPORTANT: Delete the lead that was just processed.
        batch.delete(doc(firestore, "raw_leads", lead.id));
        
        await batch.commit();
        
        // 6. Get count of remaining unprocessed leads
        const remainingQuery = query(
            collection(firestore, "raw_leads"),
            limit(50)
        );
        const remainingSnapshot = await getDocs(remainingQuery);
        const unprocessedCount = remainingSnapshot.docs.filter(doc => !doc.data().processingBy).length;

        return { 
            success: true, 
            articleId: newDraftRef.id,
            headline: summaryResult.headline,
            remaining: unprocessedCount,
            journalistId
        };
    } catch (error: any) {
        console.error(`--- DRAFT ARTICLE ACTION FAILED (${journalistId || 'journalist'}) ---`, error);
        // Attempt to get a remaining count even if the action failed, for UI consistency
        try {
            const { firestore } = getFirebaseServices();
            const remainingQuery = query(
                collection(firestore, "raw_leads"),
                limit(50)
            );
            const remainingSnapshot = await getDocs(remainingQuery);
            const unprocessedCount = remainingSnapshot.docs.filter(doc => !doc.data().processingBy).length;
            return { success: false, error: error.message, remaining: unprocessedCount, journalistId };
        } catch (countError: any) {
            return { success: false, error: error.message, remaining: 0, journalistId };
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
    const editionCreationId = `edition_${Date.now()}`; // Unique ID for tracking

    try {
        console.log(`📰 Editor [${editionCreationId}]: Starting edition creation...`);
        
        // Check for RECENT duplicate editions FIRST (created in last 5 minutes) to prevent race conditions
        const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
        const recentEditionsQuery = query(
            collection(firestore, "newspaper_editions"),
            orderBy("publicationDate", "desc"),
            limit(5)
        );
        const recentSnapshot = await getDocs(recentEditionsQuery);
        
        console.log(`🔍 Editor [${editionCreationId}]: Found ${recentSnapshot.docs.length} recent editions to check`);
        
        // Filter in memory for unpublished editions created within last 5 minutes
        const recentDrafts = recentSnapshot.docs.filter(doc => {
            const data = doc.data();
            const isRecent = !data.isPublished && data.publicationDate >= fiveMinutesAgo;
            if (isRecent) {
                console.log(`⚠️ Editor [${editionCreationId}]: Found recent unpublished edition #${data.editionNumber} (ID: ${doc.id})`);
            }
            return isRecent;
        });
        
        if (recentDrafts.length > 0) {
            const existingEdition = recentDrafts[0];
            console.log(`⚠️ Editor [${editionCreationId}]: SKIPPING - Found recent draft edition #${existingEdition.data().editionNumber}. Preventing duplicate creation.`);
            return { success: true, editionId: existingEdition.id };
        }
        
        console.log(`✅ Editor [${editionCreationId}]: No recent drafts found. Proceeding with creation...`);
        
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
            console.log('❌ No validated articles found for edition creation');
            return { success: false, error: "No valid articles to create an edition." };
        }

        console.log(`📊 Found ${articles.length} validated articles for edition`);

        const editionsQuery = query(collection(firestore, "newspaper_editions"), orderBy("editionNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(editionsQuery);
        let newEditionNumber = 1;
        if (!querySnapshot.empty) {
            newEditionNumber = querySnapshot.docs[0].data().editionNumber + 1;
        }

        console.log(`📝 Editor [${editionCreationId}]: Creating edition #${newEditionNumber}...`);
        const layout = await generateNewspaperLayout({ articles, editionNumber: newEditionNumber });

        const mainArticle = articles[0];
        // Use article image if available, otherwise use a news-related placeholder
        const coverImageUrl = mainArticle.imageUrl || `https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&h=500&fit=crop`;

        const editionData: Omit<Edition, 'id'> = {
            editionNumber: newEditionNumber,
            publicationDate: Timestamp.now(),
            htmlContent: layout.html, 
            coverImageUrl: coverImageUrl,
            headline: mainArticle.headline,
            isPublished: false, 
        };

        const newEditionRef = await addDoc(collection(firestore, "newspaper_editions"), editionData);
        console.log(`✅ Editor [${editionCreationId}]: Edition #${newEditionNumber} created with ID: ${newEditionRef.id}`);
        
        // Delete draft articles after edition is created (not just mark as published)
        const batch = writeBatch(firestore);
        draftsSnapshot.forEach(doc => {
            batch.delete(doc.ref); // Delete instead of updating status
        });
        await batch.commit();
        
        console.log(`🗑️ Editor [${editionCreationId}]: Deleted ${draftsSnapshot.size} draft articles from database`);

        return { success: true, editionId: newEditionRef.id };
    } catch (error: any) {
        const errorMessage = `Failed to create preview edition: ${error.message}`;
        console.error(`❌ Editor [${editionCreationId}]: ${errorMessage}`, error);
        return { success: false, error: errorMessage };
    }
}

// 6. Publisher Agent: Publishes the latest edition at the scheduled time
export async function publishLatestEditionAction(): Promise<{ success: boolean; error?: string; message?: string }> {
  const { firestore } = getFirebaseServices();
  try {
    // Get all editions, filter unpublished in memory to avoid composite index
    const allEditionsQuery = query(
      collection(firestore, "newspaper_editions"), 
      orderBy("publicationDate", "desc")
    );
    const snapshot = await getDocs(allEditionsQuery);
    
    // Filter unpublished editions in memory
    const unpublishedEditions = snapshot.docs.filter(doc => !doc.data().isPublished);
    
    if(unpublishedEditions.length === 0) {
      return { success: false, error: "No unpublished edition found to publish." };
    }

    const editionToPublish = unpublishedEditions[0];
   
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

// Publish a specific edition by ID
export async function publishEditionByIdAction(editionId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const { firestore } = getFirebaseServices();
  try {
    const editionRef = doc(firestore, "newspaper_editions", editionId);
    const editionDoc = await getDoc(editionRef);
    
    if (!editionDoc.exists()) {
      return { success: false, error: "Edition not found." };
    }
    
    const editionData = editionDoc.data();
    
    if (editionData.isPublished) {
      return { success: false, error: "Edition is already published." };
    }
   
    await updateDoc(editionRef, {
      isPublished: true,
      publicationDate: Timestamp.now(),
    });
    
    return { success: true, message: `Edition #${editionData.editionNumber} has been published.` };
  } catch (error: any) {
    const errorMessage = `Failed to publish edition: ${error.message}`;
    console.error("publishEditionByIdAction failed:", error);
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

export async function deleteEditionAction(id: string): Promise<{ success: boolean; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        console.log(`🗑️ Deleting edition: ${id}`);
        const editionRef = doc(firestore, "newspaper_editions", id);
        const editionDoc = await getDoc(editionRef);
        
        if (!editionDoc.exists()) {
            console.error(`❌ Edition ${id} not found`);
            return { success: false, error: "Edition not found" };
        }
        
        await deleteDoc(editionRef);
        console.log(`✅ Successfully deleted edition: ${id}`);
        return { success: true };
    } catch (error: any) {
        console.error(`❌ Failed to delete edition ${id}:`, error);
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
    try {
        console.log('🧹 clearAllDataAction: Starting...');
        const { firestore } = getFirebaseServices();
        const { withTimeout } = await import('@/lib/firebase-server');
        console.log('✅ Firebase services initialized');
        
        const collections = [
            "raw_leads", 
            "draft_articles",
            "leads_journalist_1",
            "leads_journalist_2",
            "leads_journalist_3",
            "leads_journalist_4",
            "leads_journalist_5"
        ];
        let totalDeleted = 0;
        
        for (const colName of collections) {
            console.log(`📂 Fetching ${colName} collection...`);
            
            try {
                const snapshot = await withTimeout(
                    getDocs(collection(firestore, colName)),
                    20000,
                    `Fetch ${colName} collection`
                );
                console.log(`📊 Found ${snapshot.docs.length} documents in ${colName}`);
                
                if (snapshot.docs.length > 0) {
                    const batch = writeBatch(firestore);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    
                    await withTimeout(
                        batch.commit(),
                        20000,
                        `Delete batch for ${colName}`
                    );
                    totalDeleted += snapshot.docs.length;
                    console.log(`✅ Deleted ${snapshot.docs.length} documents from ${colName}`);
                } else {
                    console.log(`ℹ️ No documents to delete in ${colName}`);
                }
            } catch (error: any) {
                console.error(`❌ Failed to process ${colName}:`, error.message);
                // Continue with next collection even if one fails
            }
        }

        console.log(`✅ clearAllDataAction: Successfully deleted ${totalDeleted} documents`);
        return { success: true };
    } catch (error: any) {
        console.error("❌ clearAllDataAction failed:", error);
        console.error("Error details:", error.message, error.stack);
        return { success: false, error: error.message };
    }
}

    