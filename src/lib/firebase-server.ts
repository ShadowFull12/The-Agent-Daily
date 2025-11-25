import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

// This function must only be called from within a server-side context (e.g., Server Actions)
// It ensures a stable, new, or existing Firebase app instance is used for each server action.
export function getFirebaseServices() {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const firestore = getFirestore(app);
    return { firestore };
}
