'use server';
/**
 * @fileOverview AI flow to check if two news article titles are essentially the same story.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CheckDuplicateInputSchema = z.object({
  title1: z.string().describe('The first article title to compare.'),
  title2: z.string().describe('The second article title to compare.'),
});
export type CheckDuplicateInput = z.infer<typeof CheckDuplicateInputSchema>;

const CheckDuplicateOutputSchema = z.object({
  isDuplicate: z.boolean().describe('True if the two titles are essentially about the same story, false otherwise.'),
  reason: z.string().describe('Brief explanation of why they are or are not duplicates.'),
});
export type CheckDuplicateOutput = z.infer<typeof CheckDuplicateOutputSchema>;

export async function checkDuplicate(
  input: CheckDuplicateInput
): Promise<CheckDuplicateOutput> {
  return checkDuplicateFlow(input);
}

const checkDuplicatePrompt = ai.definePrompt({
  name: 'checkDuplicatePrompt',
  input: {schema: CheckDuplicateInputSchema},
  output: {schema: CheckDuplicateOutputSchema},
  prompt: `You are an expert news editor. Your task is to determine if two news article titles are essentially reporting the same story or event.

**Instructions:**
1. Compare the two titles carefully.
2. Determine if they are about the same core news story, event, or topic.
3. Titles may use different wording but still be about the same story.
4. If they refer to the same person, place, event, or breaking news, they are likely duplicates.
5. If they are about completely different topics or events, they are not duplicates.

**Title 1:** {{title1}}

**Title 2:** {{title2}}

Return your response as a JSON object with 'isDuplicate' (boolean) and 'reason' (string) fields.
`,
});

const checkDuplicateFlow = ai.defineFlow(
  {
    name: 'checkDuplicateFlow',
    inputSchema: CheckDuplicateInputSchema,
    outputSchema: CheckDuplicateOutputSchema,
  },
  async input => {
    const {output} = await checkDuplicatePrompt(input);
    if (!output) {
      throw new Error('The AI failed to check for duplicates.');
    }
    return output;
  }
);
