import { NextResponse } from "next/server";
import { getFirebaseServices } from "@/lib/firebase-server";
import { collection, getDocs, query, orderBy, writeBatch } from "firebase/firestore";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cleanup endpoint to remove duplicate draft editions
export async function POST() {
  try {
    const { firestore } = getFirebaseServices();
    
    const editionsQuery = query(
      collection(firestore, "newspaper_editions"),
      orderBy("editionNumber", "desc")
    );
    
    const snapshot = await getDocs(editionsQuery);
    
    // Group by edition number and keep only the latest of each
    const editionsByNumber = new Map<number, any[]>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const editionNum = data.editionNumber;
      
      if (!editionsByNumber.has(editionNum)) {
        editionsByNumber.set(editionNum, []);
      }
      
      editionsByNumber.get(editionNum)?.push({
        id: doc.id,
        ref: doc.ref,
        ...data
      });
    });
    
    // Find duplicates to delete
    const toDelete: any[] = [];
    let draftCount = 0;
    
    editionsByNumber.forEach((editions, editionNum) => {
      if (editions.length > 1) {
        // Sort by creation date (newest first)
        editions.sort((a, b) => {
          const aTime = a.publicationDate?.toMillis() || 0;
          const bTime = b.publicationDate?.toMillis() || 0;
          return bTime - aTime;
        });
        
        // Keep the first (newest), delete the rest
        const [keep, ...duplicates] = editions;
        console.log(`Edition #${editionNum}: Keeping ${keep.id}, deleting ${duplicates.length} duplicates`);
        toDelete.push(...duplicates);
      }
      
      // Count drafts
      editions.forEach(ed => {
        if (!ed.isPublished) draftCount++;
      });
    });
    
    // Delete duplicates
    if (toDelete.length > 0) {
      const batch = writeBatch(firestore);
      toDelete.forEach(edition => {
        batch.delete(edition.ref);
      });
      await batch.commit();
      console.log(`✅ Cleaned up ${toDelete.length} duplicate editions`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleanup complete`,
      deleted: toDelete.length,
      remainingDrafts: draftCount - toDelete.filter(e => !e.isPublished).length,
      uniqueEditions: editionsByNumber.size
    });
    
  } catch (error: any) {
    console.error("❌ Cleanup failed:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
