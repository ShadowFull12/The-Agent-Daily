'use server';
/**
 * @fileOverview AI flow to check if two news article titles are essentially the same story.
 */

import { callKimi } from '@/lib/openrouter';
import { ai } from '@/ai/genkit';
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
    // Try Kimi K2 Thinking first
    console.log('🤖 Trying Kimi K2 Thinking for duplicate check...');
    const response = await callKimi(prompt, systemPrompt);
    
    // Clean response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    const parsed = JSON.parse(cleanResponse);
    console.log('✅ Kimi K2 Thinking duplicate check successful');
    return {
      isDuplicate: parsed.isDuplicate || false,
      reason: parsed.reason || 'No reason provided',
    };
  } catch (kimiError) {
    console.warn('⚠️ Kimi K2 failed, falling back to Gemini 2.5 Pro:', kimiError);
    
    // Fallback to Gemini 2.5 Pro
    try {
      const result = await ai.generate({
        model: 'googleai/gemini-2.5-pro',
        prompt: prompt,
        output: {
          schema: CheckDuplicateOutputSchema,
        },
        config: {
          temperature: 0.3,
        },
      });

      console.log('✅ Gemini 2.5 Pro duplicate check successful');
      return result.output!;
    } catch (geminiError) {
      console.error('❌ Both Kimi K2 and Gemini failed:', geminiError);
      // Default to not duplicate if both fail
      return {
        isDuplicate: false,
        reason: 'AI check failed for both models',
      };
    }
  }
}
