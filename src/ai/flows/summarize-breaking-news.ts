
'use server';
/**
 * @fileOverview A flow for summarizing breaking news articles based on provided content.
 */

import { callGrok } from '@/lib/openrouter';

export interface SummarizeBreakingNewsInput {
  url: string;
  title: string;
  topic: string;
  content: string;
}

export interface SummarizeBreakingNewsOutput {
  summary: string;
  headline: string;
}

export async function summarizeBreakingNews(
  input: SummarizeBreakingNewsInput
): Promise<SummarizeBreakingNewsOutput> {
  const prompt = `You are an expert journalist. Rewrite the provided article content into a detailed and objective news report.

**Instructions:**
1. Write a Detailed Report of approximately 250 words based ONLY on the Article Content provided
2. Create a compelling, newspaper-style headline
3. Maintain neutral, objective, factual tone
4. Do not access external sources

**Article Data:**
- Original Title: ${input.title}
- Topic: ${input.topic}
- Article Content:
${input.content}

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{"summary": "detailed 250-word report", "headline": "compelling headline"}`;

  const systemPrompt = `You are a professional journalist AI. Always respond with valid JSON only, no markdown formatting.`;

  const response = await callGrok(prompt, systemPrompt);
  
  // Clean response
  let cleanResponse = response.trim();
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  try {
    const parsed = JSON.parse(cleanResponse);
    return {
      summary: parsed.summary || 'Failed to generate summary',
      headline: parsed.headline || input.title,
    };
  } catch (error) {
    console.error('Failed to parse Grok response:', cleanResponse);
    return {
      summary: input.content.substring(0, 500),
      headline: input.title,
    };
  }
}

    