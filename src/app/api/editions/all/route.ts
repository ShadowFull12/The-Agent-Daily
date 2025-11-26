import { NextResponse } from "next/server";
import { getFirebaseServices } from "@/lib/firebase-server";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    
    // Return all editions (both drafts and published)
    const editions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ editions }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error("❌ Failed to fetch editions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch editions" },
      { status: 500 }
    );
  }
}
