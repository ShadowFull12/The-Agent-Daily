import { NextResponse } from "next/server";
import { getFirebaseServices } from "@/lib/firebase-server";
import { doc, deleteDoc } from "firebase/firestore";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { firestore } = getFirebaseServices();
    await deleteDoc(doc(firestore, "newspaper_editions", params.id));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete edition:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
