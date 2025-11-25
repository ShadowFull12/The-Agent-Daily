
'use server';
/**
 * @fileOverview A flow for summarizing breaking news articles based on provided content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeBreakingNewsInputSchema = z.object({
  url: z.string().url().describe('The URL of the breaking news article.'),
  title: z.string().describe('The title of the news article.'),
  topic: z.string().describe('The topic of the news article.'),
  content: z.string().describe('The content/description of the article to be summarized.'),
});
export type SummarizeBreakingNewsInput = z.infer<
  typeof SummarizeBreakingNewsInputSchema
>;

const SummarizeBreakingNewsOutputSchema = z.object({
  summary: z
    .string()
    .describe('A detailed, objective news report of 400-500 words based on the provided content.'),
  headline: z
    .string()
    .describe('A compelling, newspaper-style headline for the article.')
});
export type SummarizeBreakingNewsOutput = z.infer<
  typeof SummarizeBreakingNewsOutputSchema
>;

export async function summarizeBreakingNews(
  input: SummarizeBreakingNewsInput
): Promise<SummarizeBreakingNewsOutput> {
  return summarizeBreakingNewsFlow(input);
}

const summarizeBreakingNewsPrompt = ai.definePrompt({
  name: 'summarizeBreakingNewsPrompt',
  input: {schema: SummarizeBreakingNewsInputSchema},
  output: {schema: SummarizeBreakingNewsOutputSchema},
  prompt: `You are an expert journalist. Your task is to rewrite the provided article content into a detailed and objective news report.

  **Instructions:**
  1.  **Write a Detailed Report**: Based *only* on the 'Article Content' provided, write a comprehensive news report of approximately 400-500 words. Do not make it a short summary. Elaborate on the key points, provide context, and structure it like a professional news article.
  2.  **Create a Headline**: Write a new, compelling, newspaper-style headline that accurately reflects the main point of the story.
  3.  **Objective Tone**: Maintain a neutral, objective, and factual tone throughout the report. Do not inject personal opinions or biases.
  4.  **No External Info**: Do not access the provided URL or any other external sources. Your entire output must be generated from the text provided in the 'Article Content' field.

  **Article Data:**
  -   **Original Title**: {{title}}
  -   **Topic**: {{topic}}
  -   **Article Content**:
      \`\`\`
      {{{content}}}
      \`\`\`

  Return your response as a single JSON object with 'summary' and 'headline' fields.
  `,
});

const summarizeBreakingNewsFlow = ai.defineFlow(
  {
    name: 'summarizeBreakingNewsFlow',
    inputSchema: SummarizeBreakingNewsInputSchema,
    outputSchema: SummarizeBreakingNewsOutputSchema,
  },
  async input => {
    const {output} = await summarizeBreakingNewsPrompt(input);
    if (!output) {
      throw new Error('The AI failed to generate a summary.');
    }
    return output;
  }
);
