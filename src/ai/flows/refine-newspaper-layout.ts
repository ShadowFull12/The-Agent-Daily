'use server';

/**
 * @fileOverview Editor 2 - Refines and expands newspaper layout from Editor 1
 * Takes the initial HTML and makes articles bigger, fills empty spaces, improves layout
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefineNewspaperInputSchema = z.object({
  html: z.string().describe('The initial HTML from Editor 1 to refine and expand'),
  editionNumber: z.number().describe('The edition number'),
});

export type RefineNewspaperInput = z.infer<typeof RefineNewspaperInputSchema>;

const RefineNewspaperOutputSchema = z.object({
  html: z.string().describe('The refined and expanded HTML'),
});

export type RefineNewspaperOutput = z.infer<typeof RefineNewspaperOutputSchema>;

export async function refineNewspaperLayout(input: RefineNewspaperInput): Promise<RefineNewspaperOutput> {
  return refineNewspaperLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refineNewspaperLayoutPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: {schema: RefineNewspaperInputSchema},
  output: {schema: RefineNewspaperOutputSchema},
  config: {
    temperature: 0.7,
  },
}, async (input) => {
  return {
    messages: [{
      role: 'user',
      content: [{
        text: `You are **EDITOR 2** - The Refinement Specialist for "The Daily Agent" newspaper.

**YOUR ROLE:**
Editor 1 has created the initial newspaper layout. Your job is to REFINE and EXPAND it to fix layout issues and make it look professional.

**PROBLEMS YOU MUST FIX:**

1. **SHORT ARTICLES (Critical Issue):**
   - Many articles are too short (100-200 words) leaving white space
   - Articles must be EXPANDED to 400-600 words minimum
   - Add more paragraphs, quotes, context, analysis, statistics
   - Make each article feel complete and comprehensive

2. **EMPTY SPACES (Critical Issue #1 - HIGHEST PRIORITY):**
   - Pages have white space at bottom or sides
   - IMMEDIATE FIXES (in order of priority):
     a) EXPAND existing articles - Add 2-3 more paragraphs to each article
     b) Make articles span-2 - Use more space horizontally
     c) Add multi-column class to long articles
     d) Only as LAST resort: Add 1-2 COMPACT info boxes (see sizing rules below)

3. **TEXT BOXES TOO LARGE AND EMPTY (Critical Issue #2):**
   - **PROBLEM:** Info boxes have huge padding/height but minimal content
   - **SYMPTOM:** Box is 300-400px tall with only 2 lines of text inside
   - **ROOT CAUSE:** Excessive padding (2rem), large fonts (1.1rem), big margins (1rem between items)
   - **SOLUTION:**
     * Reduce padding to 0.8rem
     * Reduce font-size to 0.9rem
     * Reduce margins to 0.3rem between items
     * Remove any fixed heights
     * Add 3-5 compact data points instead of 1-2
     * OR delete box and expand article next to it instead

4. **LAYOUT BALANCE:**
   - Some columns are too short while others are long
   - Redistribute content more evenly across columns
   - Ensure all pages have similar heights (min-height: 1400px)
   - Use span-2 classes strategically to balance layout

**SPECIFIC INSTRUCTIONS:**

**For Articles:**
- **Minimum 400 words per article** (currently many are 150-250 words)
- Add MORE paragraphs to each article:
  * Opening paragraph: Set the scene with who/what/where/when
  * Context paragraph: Background information, history
  * Details paragraph: Specific facts, numbers, quotes
  * Analysis paragraph: Implications, impact, future outlook
  * Closing paragraph: Conclusions, next steps, broader significance
- Add expert quotes: "According to [expert name], '[insightful quote]'"
- Add statistics: "Recent data shows that..." or "In 2024, there was a X% increase..."
- Add regional context: How this affects different states/cities
- Add comparative context: How this compares to previous years/other countries

**For Info Boxes & Widgets - CRITICAL SIZE RULES:**

**ABSOLUTE RULE: NO LARGE EMPTY TEXT BOXES**

If you see a text box that looks like this:
```html
<div class="info-box" style="height: 400px; padding: 2rem;">
  <h4>Market Watch</h4>
  <p>Sensex: 82,347</p>
</div>
```

**FIX IT IMMEDIATELY:**

**Option 1 - Make Box COMPACT (Preferred):**
```html
<div class="info-box" style="padding: 0.8rem; font-size: 0.9rem;">
  <h4 style="font-size: 1rem; margin-bottom: 0.5rem;">Market Watch</h4>
  <p style="margin: 0.3rem 0;">Sensex: 82,347 ▲ 1.2%</p>
  <p style="margin: 0.3rem 0;">Nifty: 25,184 ▲ 0.8%</p>
  <p style="margin: 0.3rem 0;">Bank Nifty: 54,230 ▲ 0.5%</p>
</div>
```

**Option 2 - Remove Box, Expand Article:**
If the box is taking up too much space, DELETE it and make the article next to it longer instead.

**MANDATORY BOX SIZING:**
- padding: 0.8rem (NOT 1.5rem or 2rem)
- font-size: 0.9rem (NOT 1rem or 1.1rem)
- line-height: 1.4 (NOT 1.8 or 2)
- margin between items: 0.3rem to 0.5rem (NOT 1rem)
- No fixed heights (let content determine height)
- Maximum 5 lines of content per box
- Use compact list format, not paragraphs

**BOX CONTENT RULES:**
- Quote boxes: 2-3 lines maximum, 15-20 words total
- Stat boxes: One number + one label, that's it
- Market data: List format (Sensex: X, Nifty: Y, Bank Nifty: Z)
- Weather: City name + temperature, compact table
- News briefs: 4-5 items, one line each
- NO long explanatory paragraphs in boxes
- Explanation goes in ARTICLES, not boxes

**For Layout Issues:**

**Problem: White space at bottom right (Image 3)**
- SOLUTION: Expand the articles above to be much longer
- SOLUTION: Add 2-3 additional info boxes with expanded content
- SOLUTION: Use multi-column class to spread text across more space
- SOLUTION: Add a large quote box or "Did You Know?" box

**Problem: Article too short on right side (Image 1)**
- SOLUTION: Expand that article from 200 words to 500+ words
- SOLUTION: Add more paragraphs about the topic
- SOLUTION: Add quotes from multiple sources
- SOLUTION: Add historical context and future predictions

**Problem: Almost perfect but needs one more element (Image 2)**
- SOLUTION: Add a well-populated info box or quote box
- SOLUTION: Expand existing text boxes with more content
- SOLUTION: Make one article span-2 to fill better

**Problem: Info boxes too big but empty (Image 4)**
- SOLUTION: Fill them with actual text content
- SOLUTION: Add 3-5 paragraphs of informative text
- SOLUTION: Don't just show raw data, explain it
- SOLUTION: Add bullet points with detailed descriptions

**HTML EDITING RULES:**

1. **DO NOT create from scratch** - Edit the existing HTML
2. **Expand article content** - Add more <p> tags with substantial text
3. **Enhance info boxes** - Add <p> tags with explanatory text before/after data
4. **Add missing elements** - If page has white space, add boxes/content
5. **Adjust classes** - Add span-2, multi-column where needed for balance
6. **Keep structure** - Don't change page order or remove articles
7. **Return complete HTML** - From <!DOCTYPE html> to </html>

**EXAMPLE TRANSFORMATIONS:**

**BEFORE (Short article):**
\`\`\`html
<article class="story">
  <span class="kicker">Politics</span>
  <h2>New Policy Announced</h2>
  <p><strong>NEW DELHI:</strong> The government announced a new policy today. It will affect many people.</p>
</article>
\`\`\`

**AFTER (Expanded article):**
\`\`\`html
<article class="story span-2 multi-column">
  <span class="kicker">Politics</span>
  <h2>New Policy Announced</h2>
  <p class="byline">By Rajesh Kumar | New Delhi</p>
  <p><strong>NEW DELHI:</strong> In a significant move that could reshape the economic landscape, the central government announced a comprehensive new policy framework today aimed at boosting employment and industrial growth across multiple sectors.</p>
  
  <p>The policy, unveiled by Finance Minister during a press conference at Vigyan Bhawan, introduces several key reforms including streamlined regulatory approvals, enhanced tax incentives for startups, and expanded infrastructure investment programs. "This is a watershed moment for India's economic development," the minister stated.</p>
  
  <p>According to preliminary estimates from the Ministry of Commerce, the new framework is expected to directly impact over 15 million workers across manufacturing, services, and technology sectors. Industry experts have welcomed the move, with Confederation of Indian Industry (CII) calling it a "bold and timely intervention."</p>
  
  <p>Dr. Priya Sharma, an economist at the Indian Institute of Management, noted that "this policy addresses long-standing structural issues in our regulatory system. The emphasis on ease of doing business while maintaining environmental safeguards shows a balanced approach."</p>
  
  <p>The implementation timeline spans 18 months, with the first phase focusing on metropolitan areas before extending to tier-2 and tier-3 cities. State governments have been given flexibility to customize certain provisions based on local industrial needs.</p>
</article>
\`\`\`

**BEFORE (Empty info box):**
\`\`\`html
<div class="info-box">
  <h4>Market Data</h4>
  <p>Sensex: 82,347 ▲ 1.2%</p>
  <p>Nifty: 25,184 ▲ 0.8%</p>
</div>
\`\`\`

**AFTER (Populated info box):**
\`\`\`html
<div class="info-box">
  <h4>Market Watch: Strong Gains Continue</h4>
  <p>Indian equity markets extended their winning streak for the fifth consecutive session, buoyed by positive global cues and robust domestic corporate earnings.</p>
  
  <p><strong>BSE Sensex:</strong> Closed at 82,347.15 points, up 979 points (1.2%). The index touched an intraday high of 82,598 during early trading hours, driven by gains in banking, IT, and energy stocks.</p>
  
  <p><strong>NSE Nifty 50:</strong> Ended at 25,184.30 points, gaining 199 points (0.8%). Reliance Industries, HDFC Bank, and Infosys were among the top contributors to the rally.</p>
  
  <p>Market analysts attribute the surge to strong FII inflows totaling ₹3,450 crore and optimism surrounding upcoming GDP data. Trading volumes remained healthy with ₹1.2 lakh crore worth of shares changing hands on NSE.</p>
</div>
\`\`\`

**YOUR HTML TO REFINE:**

${input.html}

**NOW, REFINE AND EXPAND THIS HTML:**

Carefully analyze the layout, identify short articles, empty spaces, and thin content. Then systematically expand articles to 400-600 words, fill info boxes with explanatory text, and ensure no white space remains. Return the complete refined HTML.`
      }]
    }]
  };
});

const refineNewspaperLayoutFlow = ai.defineFlow(
  {
    name: 'refineNewspaperLayoutFlow',
    inputSchema: RefineNewspaperInputSchema,
    outputSchema: RefineNewspaperOutputSchema,
  },
  async (input) => {
    const result = await prompt(input);
    return result.output!;
  }
);
