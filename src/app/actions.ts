
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

// Action to run just the Scout agent to find new leads
export async function findLeadsAction(): Promise<{ success: boolean; error?: string; message?: string }> {
  const { firestore } = getFirebaseServices();
  
  try {
    const topics = ["world", "technology", "business", "science"];
    const searchResult = await searchBreakingNews({ topics });
    
    if (!searchResult.stories || searchResult.stories.length === 0) {
      return { success: true, message: "Scout agent ran, but found no new stories from the API." };
    }
    
    // Remove duplicates by URL before storing
    const uniqueStories = Array.from(new Map(searchResult.stories.map(s => [s.url, s])).values());
    
    const batch = writeBatch(firestore);
    const leadsCollection = collection(firestore, "raw_leads");

    uniqueStories.forEach(story => {
        const newLeadRef = doc(leadsCollection); // Create a new doc reference with a unique ID
        const leadData: Omit<RawLead, 'id'> = {
          topic: story.topic,
          url: story.url,
          imageUrl: story.imageUrl || '',
          createdAt: Timestamp.now(),
          title: story.title,
          content: story.content || '',
        };
        batch.set(newLeadRef, leadData);
    });
    
    await batch.commit();
    return { success: true, message: `Scout found and stored ${uniqueStories.length} new leads.` };

  } catch (error: any) {
    const errorMessage = `Scout Agent Failed: ${error.message}`;
    console.error("findLeadsAction failed:", error);
    return { success: false, error: errorMessage };
  }
}

// Action to run the Journalist agent to draft a SINGLE article from the oldest lead
export async function draftSingleArticleAction(): Promise<{ success: boolean; error?: string; message?: string }> {
    const { firestore } = getFirebaseServices();
    try {
        const leadsQuery = query(collection(firestore, "raw_leads"), orderBy("createdAt", "asc"), limit(1));
        const leadsSnapshot = await getDocs(leadsQuery);

        if (leadsSnapshot.empty) {
            return { success: true, message: "No more raw leads to process." };
        }

        const leadDoc = leadsSnapshot.docs[0];
        const lead = { id: leadDoc.id, ...leadDoc.data() } as RawLead;

        try {
            const summaryResult = await summarizeBreakingNews({ url: lead.url, title: lead.title, topic: lead.topic, content: lead.content });
            
            const draft: Omit<DraftArticle, 'id'|'createdAt'> = {
                rawLeadId: lead.id,
                headline: summaryResult.headline,
                content: summaryResult.summary,
                imageUrl: lead.imageUrl,
            };
            
            const batch = writeBatch(firestore);
            
            const newDraftRef = doc(collection(firestore, "draft_articles"));
            batch.set(newDraftRef, { ...draft, createdAt: Timestamp.now() });
            
            const leadRef = doc(firestore, "raw_leads", lead.id);
            batch.delete(leadRef);
            
            await batch.commit();

            return { 
                success: true, 
                message: `Successfully drafted article: "${summaryResult.headline}"`
            };

        } catch (innerError: any) {
            console.error(`Failed to process lead ${lead.id}: "${lead.title}". Error: ${innerError.message}`);
            // If one article fails, we log it and return an error for this specific attempt.
            return { success: false, error: `Failed to process lead "${lead.title}". Please try again.`}
        }
    } catch (error: any) {
        const errorMessage = `Journalist Agent Failed: ${error.message}`;
        console.error("draftSingleArticleAction failed:", error);
        return { success: false, error: errorMessage };
    }
}


// Action to generate the edition, but not publish it live.
export async function createPreviewEditionAction(): Promise<{ success: boolean; error?: string; editionId?: string }> {
    const { firestore } = getFirebaseServices();

    try {
        const draftsSnapshot = await getDocs(query(collection(firestore, "draft_articles"), orderBy("createdAt", "desc"), limit(50)));
        const articles = draftsSnapshot.docs.map(doc => ({...doc.data(), id: doc.id})) as DraftArticle[];

        if (articles.length < 1) { // A single article is enough for a preview
            return { success: false, error: "Not enough articles to create a preview. Need at least 1 draft." };
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
            isPublished: false, // <-- Set to false for review
        };

        const newEditionRef = await addDoc(collection(firestore, "newspaper_editions"), editionData);
        
        const batch = writeBatch(firestore);
        draftsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        return { success: true, editionId: newEditionRef.id };
    } catch (error: any) {
        const errorMessage = `Failed to create preview edition: ${error.message}`;
        console.error("createPreviewEditionAction failed:", error);
        return { success: false, error: errorMessage };
    }
}


// Action to make the latest unpublished edition live
export async function publishLatestEditionAction(): Promise<{ success: boolean; error?: string; message?: string }> {
  const { firestore } = getFirebaseServices();
  try {
    // Fetch recent editions, sort by date client-side to find the one to publish
    const q = query(
      collection(firestore, "newspaper_editions"), 
      orderBy("publicationDate", "desc"), 
      limit(10) // Fetch a few recent editions to be safe
    );
    const snapshot = await getDocs(q);
    
    if(snapshot.empty) {
      return { success: false, error: "No editions found to publish." };
    }

    // Find the newest edition that is currently unpublished
    const latestUnpublishedEdition = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Edition))
        .find(edition => edition.isPublished === false);

    if (!latestUnpublishedEdition) {
         return { success: false, error: "No unpublished editions found to publish." };
    }
   
    await updateDoc(doc(firestore, "newspaper_editions", latestUnpublishedEdition.id), {
      isPublished: true,
      publicationDate: Timestamp.now(), // Update publication date to now
    });
    
    return { success: true, message: `Edition #${latestUnpublishedEdition.editionNumber} has been published.` };
  } catch (error: any) {
    const errorMessage = `Failed to publish latest edition: ${error.message}`;
    console.error("publishLatestEditionAction failed:", error);
    return { success: false, error: errorMessage };
  }
}

export async function deleteItemAction(
    collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions', 
    docId: string
): Promise<{ success: boolean; error?: string; }> {
    const { firestore } = getFirebaseServices();
    try {
        if (!['raw_leads', 'draft_articles', 'newspaper_editions'].includes(collectionName)) {
            throw new Error("Invalid collection name.");
        }
        await deleteDoc(doc(firestore, collectionName, docId));
        return { success: true };
    } catch (error: any) {
        const errorMessage = `Failed to delete document ${docId} from ${collectionName}: ${error.message}`;
        console.error(errorMessage, error);
        return { success: false, error: errorMessage };
    }
}

export async function deleteMultipleItemsAction(
    collectionName: 'raw_leads' | 'draft_articles' | 'newspaper_editions',
    docIds: string[]
): Promise<{ success: boolean; error?: string }> {
    if (!docIds || docIds.length === 0) {
        return { success: true }; // Nothing to delete
    }

    const { firestore } = getFirebaseServices();
    try {
        if (!['raw_leads', 'draft_articles', 'newspaper_editions'].includes(collectionName)) {
            throw new Error("Invalid collection name.");
        }
        
        const batch = writeBatch(firestore);
        docIds.forEach(id => {
            const docRef = doc(firestore, collectionName, id);
            batch.delete(docRef);
        });
        
        await batch.commit();
        
        return { success: true };
    } catch (error: any) {
        const errorMessage = `Failed to delete ${docIds.length} documents from ${collectionName}: ${error.message}`;
        console.error(errorMessage, error);
        return { success: false, error: errorMessage };
    }
}
