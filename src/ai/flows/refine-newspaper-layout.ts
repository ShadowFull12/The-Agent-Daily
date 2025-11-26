'use server';

/**
 * @fileOverview Senior Editor using Gemini 3 Pro Preview to refine newspaper layout
 * This is the Chief Editor that reviews and improves the junior editor's work
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefineNewspaperLayoutInputSchema = z.object({
  html: z.string().describe('The HTML from the junior editor to review and refine'),
  articleCount: z.number().describe('Number of articles in the newspaper'),
  categories: z.string().describe('Categories present in the newspaper'),
});

export type RefineNewspaperLayoutInput = z.infer<typeof RefineNewspaperLayoutInputSchema>;

const RefineNewspaperLayoutOutputSchema = z.object({
  html: z.string().describe('The refined HTML after senior editor review'),
});

export type RefineNewspaperLayoutOutput = z.infer<typeof RefineNewspaperLayoutOutputSchema>;

export async function refineNewspaperLayout(input: RefineNewspaperLayoutInput): Promise<RefineNewspaperLayoutOutput> {
  return refineNewspaperLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refineNewspaperLayoutPrompt',
  model: 'googleai/gemini-3-pro-preview',
  input: {schema: RefineNewspaperLayoutInputSchema},
  output: {schema: RefineNewspaperLayoutOutputSchema},
  config: {
    temperature: 1.0, // Gemini 3 Pro works best at default temperature
    thinking_level: 'high', // Maximum reasoning depth for careful review
  },
}, async (input) => {
  return {
    messages: [{
      role: 'user',
      content: [{
        text: `You are the **CHIEF EDITOR** of "The Daily Agent" newspaper, reviewing the work of a junior editor.

**YOUR ROLE:**
You are the final authority on newspaper quality. Review the HTML layout created by the junior editor and make improvements to ensure it meets professional standards.

**WHAT YOU RECEIVE:**
- HTML newspaper layout with ${input.articleCount} articles
- Categories: ${input.categories}
- The junior editor has already created the basic structure

**YOUR RESPONSIBILITIES:**

1. **ARTICLE QUALITY & LENGTH:**
   - Ensure articles are SUBSTANTIAL (300-500 words minimum)
   - Text-only articles (no images) should have EXTRA content (400-600 words)
   - Add more paragraphs, context, details, quotes, and analysis where needed
   - Make articles feel complete and informative, not rushed
   - Add bylines with reporter names and locations if missing

2. **PAGE COUNT & STRUCTURE:**
   - Target: **10-15 pages MINIMUM**
   - If junior editor only created 6-8 pages, EXPAND categories into multiple pages
   - National news: Should span 2-3 pages if there are 5+ articles
   - International news: Should span 2-3 pages if there are 5+ articles  
   - Sports/Business/Tech: Each should get 1-2 pages if articles available
   - **STRATEGY:** Split large categories across multiple pages rather than cramming

3. **LAYOUT IMPROVEMENTS:**
   - Ensure NO WHITE SPACE - every page should feel full
   - Check that pages with odd article counts use span-2 classes properly
   - Verify long articles use multi-column class for text flow
   - Add strategic data boxes where pages need filling (but keep compact)
   - Ensure consistent page heights (all pages equal length)

4. **COMPONENT ENRICHMENT:**
   Add components that junior editor may have missed:
   
   **Sports Pages should include:**
   - Cricket scorecards (IPL, Test matches, ODI)
   - Football match results (Premier League, La Liga, Champions League)
   - F1 race results and standings (if F1 weekend)
   - Tennis rankings and tournament results
   - Other sports: Badminton, Hockey, Athletics
   
   **Science/Tech Pages should include:**
   - Science facts or discoveries
   - Technology news snippets (startups, funding, launches)
   - Research breakthroughs
   - Space exploration updates
   
   **Culture/Entertainment Pages should include:**
   - New movie releases (Bollywood & Hollywood)
   - OTT series premieres (Netflix, Prime, Disney+)
   - Music chart toppers
   - Book releases
   - Celebrity news
   
   **All Pages can have:**
   - Quote of the Day (inspirational or thought-provoking)
   - Did You Know? (interesting facts)
   - This Day in History
   - Word of the Day
   - Health/Lifestyle tips

5. **VISUAL BALANCE:**
   - **Articles WITHOUT images:** Should be placed together in clusters
   - **Articles WITH images:** Distributed across the page for visual interest
   - **Strategy:** Group 2-3 text-only articles together, makes layout cleaner
   - Large images for hero stories, medium images for regular articles
   - Ensure images have proper captions

6. **MULTI-PAGE CATEGORY EXPANSION:**
   If a category has 6+ articles, SPLIT into multiple pages:
   - **Example:** National News Part I (Page 2), National News Part II (Page 3)
   - **Example:** Business & Markets (Page 5), Business & Economy (Page 6)
   - **Example:** Sports - Cricket (Page 8), Sports - Football & More (Page 9)
   
   This makes the newspaper feel substantial and comprehensive.

7. **FINAL POLISH:**
   - Fix any formatting inconsistencies
   - Ensure all page headers have correct colors and titles
   - Verify all sections have proper navigation
   - Check that date and edition number are correct
   - Ensure professional typography throughout

**CRITICAL INSTRUCTIONS:**
- Review the HTML thoroughly - understand the layout and content
- Make intelligent improvements based on your reasoning
- EXPAND articles significantly - add more content, make them bigger
- INCREASE page count to 10-15+ pages by splitting categories
- Add missing components (sports scores, science facts, movie releases, quotes)
- Cluster text-only articles together for better visual flow
- Return COMPLETE HTML from <!DOCTYPE html> to </html>
- NO markdown formatting, NO code blocks, just clean HTML
- If you see major issues, FIX them comprehensively

**HTML TO REVIEW:**

${input.html}

**NOW, AS CHIEF EDITOR, REVIEW AND IMPROVE THIS NEWSPAPER:**
Think carefully about layout, article length, page count, components, and visual balance. Then return your refined HTML.`
      }]
    }]
  };
});

const refineNewspaperLayoutFlow = ai.defineFlow(
  {
    name: 'refineNewspaperLayoutFlow',
    inputSchema: RefineNewspaperLayoutInputSchema,
    outputSchema: RefineNewspaperLayoutOutputSchema,
  },
  async (input) => {
    const result = await prompt(input);
    return result.output!;
  }
);
