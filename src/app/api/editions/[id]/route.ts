import { NextRequest, NextResponse } from "next/server";
import { getFirebaseServices } from "@/lib/firebase-server";
import { doc, deleteDoc, getDoc } from "firebase/firestore";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const { firestore } = getFirebaseServices();
    
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (!id || id === '[id]') {
      console.error("❌ No edition ID in URL");
      return NextResponse.json(
        { success: false, error: "Edition ID is required" },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`🗑️ Attempting to delete edition: ${id}`);
    
    // Verify edition exists before deleting
    const editionRef = doc(firestore, "newspaper_editions", id);
    const editionDoc = await getDoc(editionRef);
    
    if (!editionDoc.exists()) {
      console.error(`❌ Edition ${id} not found`);
      return NextResponse.json(
        { success: false, error: "Edition not found" },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    await deleteDoc(editionRef);
    console.log(`✅ Successfully deleted edition: ${id}`);
    
    return NextResponse.json(
      { success: true },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("❌ Failed to delete edition:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete edition" },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
