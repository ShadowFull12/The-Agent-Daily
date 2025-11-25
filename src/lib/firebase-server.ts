
import { initializeApp, getApps, getApp, App } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

// Global cache for Firebase services
let firebaseServices: { firestore: Firestore; app: App } | null = null;

// This function must only be called from within a server-side context (e.g., Server Actions)
// It ensures a stable, new, or existing Firebase app instance is used for each server action.
export function getFirebaseServices() {
    if (process.env.NODE_ENV === 'production' && firebaseServices) {
        console.log('🔥 Reusing cached Firebase services in production');
        return firebaseServices;
    }
    
    try {
        console.log('🔥 Initializing Firebase services...');
        
        // Check if Firebase config is valid
        if (!firebaseConfig || !firebaseConfig.projectId) {
            throw new Error('Firebase config is missing or invalid');
        }
        
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const firestore = getFirestore(app);
        
        console.log('✅ Firebase initialized successfully for project:', firebaseConfig.projectId);
        
        const services = { firestore, app };
        
        // Cache in production
        if (process.env.NODE_ENV === 'production') {
            firebaseServices = services;
        }

        return services;

    } catch (error: any) {
        console.error('❌ Failed to initialize Firebase:', error);
        console.error('Config present:', !!firebaseConfig);
        throw error;
    }
}
