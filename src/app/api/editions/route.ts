import { NextResponse } from "next/server";
import { getFirebaseServices } from "@/app/actions";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const { firestore } = getFirebaseServices();
    const editionsQuery = query(
      collection(firestore, "newspaper_editions"),
      orderBy("editionNumber", "desc")
    );
    const snapshot = await getDocs(editionsQuery);
    
    const editions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ editions });
  } catch (error: any) {
    console.error("Failed to fetch editions:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
