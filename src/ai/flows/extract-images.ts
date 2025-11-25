'use server';
/**
 * @fileOverview Extracts valid image URLs from articles.
 *
 * - extractImages - A function that extracts image URLs from an article.
 * - ExtractImagesInput - The input type for the extractImages function.
 * - ExtractImagesOutput - The return type for the extractImages function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractImagesInputSchema = z.object({
  articleContent: z
    .string()
    .describe('The content of the article from which to extract image URLs.'),
});
export type ExtractImagesInput = z.infer<typeof ExtractImagesInputSchema>;

const ExtractImagesOutputSchema = z.object({
  imageUrls: z
    .array(z.string().url())
    .describe('An array of valid image URLs extracted from the article.'),
});
export type ExtractImagesOutput = z.infer<typeof ExtractImagesOutputSchema>;

export async function extractImages(input: ExtractImagesInput): Promise<ExtractImagesOutput> {
  return extractImagesFlow(input);
}

const extractImagesPrompt = ai.definePrompt({
  name: 'extractImagesPrompt',
  input: {schema: ExtractImagesInputSchema},
  output: {schema: ExtractImagesOutputSchema},
  prompt: `You are a chief editor tasked with extracting image URLs from an article.

  Given the article content below, extract all valid image URLs.
  Return the URLs as a JSON array.

  Article Content:
  {{articleContent}}`,
});

const extractImagesFlow = ai.defineFlow(
  {
    name: 'extractImagesFlow',
    inputSchema: ExtractImagesInputSchema,
    outputSchema: ExtractImagesOutputSchema,
  },
  async input => {
    const {output} = await extractImagesPrompt(input);
    return output!;
  }
);
