'use server';

import { getFirebaseServices } from "@/lib/firebase-server";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";

export type WorkflowStep = 
  | 'idle'
  | 'clear_data'
  | 'scout'
  | 'dedup'
  | 'journalist'
  | 'validate'
  | 'editor'
  | 'complete'
  | 'error';

export type QueueState = {
  currentStep: WorkflowStep;
  attempt: number;
  draftsMade: number;
  validCount: number;
  error?: string;
  lastUpdated: any;
};

// Get the current queue state
export async function getQueueState(): Promise<QueueState | null> {
  const { firestore } = getFirebaseServices();
  const queueDoc = await getDoc(doc(firestore, 'workflow_queue', 'current'));
  
  if (!queueDoc.exists()) {
    return null;
  }
  
  return queueDoc.data() as QueueState;
}

// Update queue state
export async function updateQueueState(state: Partial<QueueState>) {
  const { firestore } = getFirebaseServices();
  const currentState = await getQueueState();
  
  const newState: any = {
    currentStep: state.currentStep ?? currentState?.currentStep ?? 'idle',
    attempt: state.attempt ?? currentState?.attempt ?? 1,
    draftsMade: state.draftsMade ?? currentState?.draftsMade ?? 0,
    validCount: state.validCount ?? currentState?.validCount ?? 0,
    lastUpdated: Timestamp.now(),
  };
  
  // Only include error field if it has a value (Firestore doesn't accept undefined)
  if (state.error !== undefined && state.error !== null) {
    newState.error = state.error;
  } else if (currentState?.error) {
    newState.error = currentState.error;
  }
  
  await setDoc(doc(firestore, 'workflow_queue', 'current'), newState);
  return newState as QueueState;
}

// Clear queue state
export async function clearQueueState() {
  const { firestore } = getFirebaseServices();
  await setDoc(doc(firestore, 'workflow_queue', 'current'), {
    currentStep: 'idle' as WorkflowStep,
    attempt: 1,
    draftsMade: 0,
    validCount: 0,
    lastUpdated: Timestamp.now(),
  });
}
