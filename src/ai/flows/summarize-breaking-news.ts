
'use server';
/**
 * @fileOverview A flow for summarizing breaking news articles based on provided content.
 */

import { callKimi } from '@/lib/openrouter';

export interface SummarizeBreakingNewsInput {
  url: string;
  title: string;
  topic: string;
  content: string;
  category?: string; // News category (National, Politics, Business, etc.)
}

export interface SummarizeBreakingNewsOutput {
  summary: string;
  headline: string;
  category: string; // Newspaper section category
  kicker: string; // Short category label for display
}

export async function summarizeBreakingNews(
  input: SummarizeBreakingNewsInput
): Promise<SummarizeBreakingNewsOutput> {
  const category = input.category || 'National';
  
  const prompt = `You are an expert journalist. Rewrite the provided article content into a detailed and objective news report.

**Instructions:**
1. Write a Detailed Report of approximately 300-350 words based ONLY on the Article Content provided
2. Create a compelling, newspaper-style headline
3. Include quotes, statistics, or expert opinions if mentioned in the source
4. Maintain neutral, objective, factual tone
5. Structure with proper paragraphs for readability
6. Do not access external sources
7. Category for this story: ${category}

**Article Data:**
- Original Title: ${input.title}
- Topic: ${input.topic}
- Category: ${category}
- Article Content:
${input.content}

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{"summary": "detailed 300-350 word report with multiple paragraphs", "headline": "compelling headline", "category": "${category}", "kicker": "short 1-2 word category label"}`;

  const systemPrompt = `You are a professional journalist AI. Always respond with valid JSON only, no markdown formatting.`;

  const response = await callKimi(prompt, systemPrompt);
  
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
      category: parsed.category || category,
      kicker: parsed.kicker || category,
    };
  } catch (error) {
    console.error('Failed to parse Kimi K2 response:', cleanResponse);
    return {
      summary: input.content.substring(0, 500),
      headline: input.title,
      category: category,
      kicker: category,
    };
  }
}

    