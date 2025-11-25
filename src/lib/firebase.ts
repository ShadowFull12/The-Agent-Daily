import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { firebaseConfig } from "@/firebase/config";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    // This is a temporary workaround for a bug in the Firebase SDK
    // where it doesn't properly handle the emulator hostnames.
    // In a real app, you would use the following:
    // connectAuthEmulator(auth, "http://127.0.0.1:9099");
    // connectFirestoreEmulator(db, "127.0.0.1", 8080);
    // connectStorageEmulator(storage, "127.0.0.1", 9199);
}


export { app, auth, db, storage };
