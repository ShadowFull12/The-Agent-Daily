'use server';
/**
 * @fileOverview AI flow to check if two news article titles are essentially the same story.
 */

import { callGrok } from '@/lib/openrouter';

export interface CheckDuplicateInput {
  title1: string;
  title2: string;
}

export interface CheckDuplicateOutput {
  isDuplicate: boolean;
  reason: string;
}

export async function checkDuplicate(
  input: CheckDuplicateInput
): Promise<CheckDuplicateOutput> {
  const prompt = `You are an expert news editor. Determine if these two news article titles are essentially reporting the same story.

**Title 1:** ${input.title1}

**Title 2:** ${input.title2}

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{"isDuplicate": true/false, "reason": "brief explanation"}`;

  const systemPrompt = `You are a news editor AI. Always respond with valid JSON only, no markdown formatting.`;

  const response = await callGrok(prompt, systemPrompt);
  
  // Clean response - remove markdown code blocks if present
  let cleanResponse = response.trim();
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  try {
    const parsed = JSON.parse(cleanResponse);
    return {
      isDuplicate: parsed.isDuplicate || false,
      reason: parsed.reason || 'No reason provided',
    };
  } catch (error) {
    console.error('Failed to parse Grok response:', cleanResponse);
    // Default to not duplicate if parsing fails
    return {
      isDuplicate: false,
      reason: 'Failed to parse AI response',
    };
  }
}
