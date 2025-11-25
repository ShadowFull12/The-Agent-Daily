
import type { Timestamp } from 'firebase/firestore';

export type AgentStatus = 'idle' | 'working' | 'cooldown' | 'success' | 'error' | 'disabled';

export interface RawLead {
    id: string;
    topic: string;
    title: string;
    content: string;
    url: string;
    imageUrl: string;
    createdAt: Timestamp;
    status: 'pending' | 'processed';
}

export interface DraftArticle {
    id: string;
    rawLeadId: string;
    headline: string;
    content: string;
    imageUrl: string;
    createdAt: Timestamp;
    status: 'drafted' | 'validated' | 'published';
}

export interface Article {
    headline: string;
    content: string;
    sourceUrl: string;
    imageUrl?: string;
}

export interface Edition {
    id: string;
    editionNumber: number;
    htmlContent: string;
    publicationDate: Timestamp;
    coverImageUrl: string;
headline: string;
    isPublished: boolean; // Added to control visibility
}
