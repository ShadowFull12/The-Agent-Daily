
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
import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";

// This function must only be called from within a server-side context (e.g., Server Actions)
// It ensures a stable, new, or existing Firebase app instance is used for each server action.
function getFirebaseServices() {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const firestore = getFirestore(app);
    return { firestore };
}

// 1. Scout Agent: Finds new leads
export async function findLeadsAction(limitStories: number = 25): Promise<{ success: boolean; leadCount: number; error?: string; }> {
  const { firestore } = getFirebaseServices();
  
  try {
    const topics = ["world", "technology", "business", "science", "politics", "entertainment", "sports"];
    const searchResult = await searchBreakingNews({ topics, limit: limitStories });
    
    if (!searchResult.stories || searchResult.stories.length === 0) {
      return { success: true, leadCount: 0 };
    }
    
    const stories = searchResult.stories.slice(0, limitStories);

    const batch = writeBatch(firestore);
    const leadsCollection = collection(firestore, "raw_leads");

    stories.forEach(story => {
        const newLeadRef = doc(leadsCollection); // Create a new doc reference
        const leadData: Omit<RawLead, 'id'> = {
          topic: story.topic,
          url: story.url,
          imageUrl: story.imageUrl || '',
          createdAt: Timestamp.now(),
          title: story.title,
          content: story.content || '',
          status: 'pending'
        };
        batch.set(newLeadRef, leadData);
    });
    
    await batch.commit();
    return { success: true, leadCount: stories.length };

  } catch (error: any) {
    console.error("findLeadsAction failed:", error);
    return { success: false, leadCount: 0, error: error.message };
  }
}

// 2. Deduplication Agent: Removes duplicate leads
export async function deduplicateLeadsAction(): Promise<{ success: boolean; deletedCount: number; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        const leadsSnapshot = await getDocs(collection(firestore, "raw_leads"));
        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawLead));

        const seenUrls = new Set<string>();
        const duplicates: string[] = [];

        leads.forEach(lead => {
            if (seenUrls.has(lead.url)) {
                duplicates.push(lead.id);
            } else {
                seenUrls.add(lead.url);
            }
        });

        if (duplicates.length > 0) {
            const batch = writeBatch(firestore);
            duplicates.forEach(id => {
                batch.delete(doc(firestore, "raw_leads", id));
            });
            await batch.commit();
        }

        return { success: true, deletedCount: duplicates.length };
    } catch (error: any) {
        console.error("deduplicateLeadsAction failed:", error);
        return { success: false, deletedCount: 0, error: error.message };
    }
}


// 3. Journalist Agent: Drafts a single article (REWRITTEN FROM SCRATCH)
export async function draftArticleAction(): Promise<{ success: boolean; articleId?: string; headline?: string; error?: string; remaining: number }> {
    const { firestore } = getFirebaseServices();
    try {
        // 1. Fetch the single oldest lead from the database.
        const leadsQuery = query(collection(firestore, "raw_leads"), where("status", "==", "pending"), orderBy("createdAt", "asc"), limit(1));
        const leadsSnapshot = await getDocs(leadsQuery);
        
        if (leadsSnapshot.empty) {
             return { success: true, remaining: 0 }; // No more leads to process
        }

        const leadDoc = leadsSnapshot.docs[0];
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
        const remainingQuery = query(collection(firestore, "raw_leads"), where("status", "==", "pending"));
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
            const remainingQuery = query(collection(firestore, "raw_leads"), where("status", "==", "pending"));
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
        const draftsSnapshot = await getDocs(query(collection(firestore, "draft_articles"), where("status", "==", "validated"), orderBy("createdAt", "desc")));
        const articles = draftsSnapshot.docs.map(doc => ({...doc.data(), id: doc.id})) as DraftArticle[];

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

    