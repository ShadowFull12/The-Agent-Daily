import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

// This function must only be called from within a server-side context (e.g., Server Actions)
// It ensures a stable, new, or existing Firebase app instance is used for each server action.
export function getFirebaseServices() {
    try {
        console.log('🔥 Initializing Firebase services...');
        
        // Check if Firebase config is valid
        if (!firebaseConfig || !firebaseConfig.projectId) {
            throw new Error('Firebase config is missing or invalid');
        }
        
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const firestore = getFirestore(app);
        
        console.log('✅ Firebase initialized successfully for project:', firebaseConfig.projectId);
        return { firestore };
    } catch (error: any) {
        console.error('❌ Failed to initialize Firebase:', error);
        console.error('Config present:', !!firebaseConfig);
        throw error;
    }
}
