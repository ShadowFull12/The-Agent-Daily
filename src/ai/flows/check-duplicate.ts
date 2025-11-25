'use server';
/**
 * @fileOverview AI flow to check if two news article titles are essentially the same story.
 */

import { callKimi } from '@/lib/openrouter';
import { z } from 'genkit';

export interface CheckDuplicateInput {
  title1: string;
  title2: string;
}

export interface CheckDuplicateOutput {
  isDuplicate: boolean;
  reason: string;
}

const CheckDuplicateOutputSchema = z.object({
  isDuplicate: z.boolean(),
  reason: z.string(),
});

export async function checkDuplicate(
  input: CheckDuplicateInput
): Promise<CheckDuplicateOutput> {
  const prompt = `You are an expert news editor. Determine if these two news article titles are essentially reporting the same story.

**Title 1:** ${input.title1}

**Title 2:** ${input.title2}

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{"isDuplicate": true/false, "reason": "brief explanation"}`;

  const systemPrompt = `You are a news editor AI. Always respond with valid JSON only, no markdown formatting.`;

  try {
    // Using Grok 4.1 Fast (free on OpenRouter)
    console.log('🤖 Using Grok 4.1 Fast for duplicate check...');
    const response = await callKimi(prompt, systemPrompt);
    
    // Clean response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    const parsed = JSON.parse(cleanResponse);
    console.log('✅ Grok 4.1 Fast duplicate check successful');
    return {
      isDuplicate: parsed.isDuplicate || false,
      reason: parsed.reason || 'No reason provided',
    };
  } catch (kimiError) {
    console.error('❌ Kimi K2 (Grok 4.1 Fast) check failed:', kimiError);
    // Default to not duplicate if AI check fails
    return {
      isDuplicate: false,
      reason: 'AI check failed - defaulting to unique',
    };
  }
}
