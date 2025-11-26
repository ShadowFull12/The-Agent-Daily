'use server';

import { getFirebaseServices } from "@/lib/firebase-server";
import { doc, setDoc, getDoc, updateDoc, Timestamp } from "firebase/firestore";

export interface WorkflowState {
  status: 'idle' | 'running' | 'success' | 'error' | 'stopping';
  currentAgent: 'scout' | 'deduplicator' | 'journalist' | 'validator' | 'editor' | 'publisher' | null;
  message: string;
  progress: {
    scout: { status: string; message: string };
    deduplicator: { status: string; message: string; checked: number; remaining: number };
    journalist: { status: string; message: string; drafted: number; remaining: number };
    journalist_1: { status: string; message: string; drafted: number };
    journalist_2: { status: string; message: string; drafted: number };
    journalist_3: { status: string; message: string; drafted: number };
    journalist_4: { status: string; message: string; drafted: number };
    journalist_5: { status: string; message: string; drafted: number };
    validator: { status: string; message: string };
    editor: { status: string; message: string };
    publisher: { status: string; message: string };
  };
  startedAt: any;
  lastUpdated: any;
}

const WORKFLOW_DOC_ID = 'current_workflow';

export async function getWorkflowState(): Promise<WorkflowState | null> {
  try {
    const { firestore } = getFirebaseServices();
    const docRef = doc(firestore, 'workflow_state', WORKFLOW_DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as WorkflowState;
    }
    return null;
  } catch (error) {
    console.error('Failed to get workflow state:', error);
    return null;
  }
}

export async function initializeWorkflowState(): Promise<void> {
  const { firestore } = getFirebaseServices();
  const docRef = doc(firestore, 'workflow_state', WORKFLOW_DOC_ID);
  
  const initialState: WorkflowState = {
    status: 'running',
    currentAgent: 'scout',
    message: 'Workflow initiated...',
    progress: {
      scout: { status: 'idle', message: '' },
      deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
      journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
      journalist_1: { status: 'idle', message: '', drafted: 0 },
      journalist_2: { status: 'idle', message: '', drafted: 0 },
      journalist_3: { status: 'idle', message: '', drafted: 0 },
      journalist_4: { status: 'idle', message: '', drafted: 0 },
      journalist_5: { status: 'idle', message: '', drafted: 0 },
      journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
      validator: { status: 'idle', message: '' },
      editor: { status: 'idle', message: '' },
      publisher: { status: 'idle', message: '' },
    },
    startedAt: Timestamp.now(),
    lastUpdated: Timestamp.now(),
  };
  
  await setDoc(docRef, initialState);
}

export async function updateWorkflowState(updates: Partial<WorkflowState>): Promise<void> {
  try {
    const { firestore } = getFirebaseServices();
    const docRef = doc(firestore, 'workflow_state', WORKFLOW_DOC_ID);
    
    await updateDoc(docRef, {
      ...updates,
      lastUpdated: Timestamp.now(),
    });
  } catch (error) {
    console.error('Failed to update workflow state:', error);
  }
}

export async function updateAgentProgress(
  agent: keyof WorkflowState['progress'],
  status: string,
  message: string,
  extra?: { checked?: number; remaining?: number; drafted?: number; deleted?: number; passed?: number }
): Promise<void> {
  try {
    const { firestore } = getFirebaseServices();
    const docRef = doc(firestore, 'workflow_state', WORKFLOW_DOC_ID);
    
    const updateData: any = {
      [`progress.${agent}.status`]: status,
      [`progress.${agent}.message`]: message,
      lastUpdated: Timestamp.now(),
    };
    
    if (extra) {
      if (extra.checked !== undefined) updateData[`progress.${agent}.checked`] = extra.checked;
      if (extra.remaining !== undefined) updateData[`progress.${agent}.remaining`] = extra.remaining;
      if (extra.drafted !== undefined) updateData[`progress.${agent}.drafted`] = extra.drafted;
      if (extra.deleted !== undefined) updateData[`progress.${agent}.deleted`] = extra.deleted;
      if (extra.passed !== undefined) updateData[`progress.${agent}.passed`] = extra.passed;
    }
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Failed to update agent progress:', error);
  }
}

export async function clearWorkflowState(): Promise<void> {
  try {
    const { firestore } = getFirebaseServices();
    const docRef = doc(firestore, 'workflow_state', WORKFLOW_DOC_ID);
    
    const clearedState: WorkflowState = {
      status: 'idle',
      currentAgent: null,
      message: '',
      progress: {
        scout: { status: 'idle', message: '' },
        deduplicator: { status: 'idle', message: '', checked: 0, remaining: 0 },
        journalist: { status: 'idle', message: '', drafted: 0, remaining: 0 },
        journalist_1: { status: 'idle', message: '', drafted: 0 },
        journalist_2: { status: 'idle', message: '', drafted: 0 },
        journalist_3: { status: 'idle', message: '', drafted: 0 },
        journalist_4: { status: 'idle', message: '', drafted: 0 },
        journalist_5: { status: 'idle', message: '', drafted: 0 },
        validator: { status: 'idle', message: '' },
        editor: { status: 'idle', message: '' },
        publisher: { status: 'idle', message: '' },
      },
      startedAt: Timestamp.now(),
      lastUpdated: Timestamp.now(),
    };
    
    await setDoc(docRef, clearedState);
  } catch (error) {
    console.error('Failed to clear workflow state:', error);
  }
}
