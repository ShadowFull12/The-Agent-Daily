import { NextResponse } from "next/server";
import { getFirebaseServices } from "@/lib/firebase-server";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const { firestore } = getFirebaseServices();
    
    if (!firestore) {
      throw new Error("Firestore not initialized");
    }
    
    const editionsQuery = query(
      collection(firestore, "newspaper_editions"),
      orderBy("editionNumber", "desc")
    );
    
    const snapshot = await getDocs(editionsQuery);
    
    // Filter to show only unpublished editions (drafts) for review
    const editions = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          status: data.isPublished ? "published" : "draft"
        };
      })
      .filter(edition => edition.status === "draft"); // Only show drafts in review

    return NextResponse.json({ editions }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error("❌ Failed to fetch editions:", error);
    console.error("Error details:", error.message, error.stack);
    return NextResponse.json(
      { error: error.message || "Failed to fetch editions" },
      { status: 500 }
    );
  }
}
