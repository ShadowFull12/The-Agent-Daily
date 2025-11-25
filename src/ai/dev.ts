import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-breaking-news.ts';
import '@/ai/flows/extract-images.ts';
import '@/ai/flows/search-breaking-news.ts';
import '@/ai/flows/generate-newspaper-layout.ts';
