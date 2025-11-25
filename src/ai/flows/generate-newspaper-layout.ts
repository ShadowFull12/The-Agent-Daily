
'use server';

/**
 * @fileOverview An AI agent for generating an HTML layout for the entire newspaper using CSS Grid and specified design rules.
 *
 * - generateNewspaperLayout - A function that generates the newspaper layout.
 * - GenerateNewspaperLayoutInput - The input type for the generateNewspaperLayout function.
 * - GenerateNewspaperLayoutOutput - The return type for the generateNewspaperLayout function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { format } from 'date-fns';


const GenerateNewspaperLayoutInputSchema = z.object({
  articles: z.array(
    z.object({
      headline: z.string(),
      content: z.string(),
      imageUrl: z.string().optional(),
    })
  ).min(1).describe('An array of articles to include in the newspaper layout.'),
  editionNumber: z.number().describe("The edition number of this newspaper."),
});

export type GenerateNewspaperLayoutInput = z.infer<typeof GenerateNewspaperLayoutInputSchema>;

const GenerateNewspaperLayoutOutputSchema = z.object({
  html: z.string().describe('The HTML string for the entire newspaper layout.'),
});

export type GenerateNewspaperLayoutOutput = z.infer<typeof GenerateNewspaperLayoutOutputSchema>;

export async function generateNewspaperLayout(input: GenerateNewspaperLayoutInput): Promise<GenerateNewspaperLayoutOutput> {
  return generateNewspaperLayoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNewspaperLayoutPrompt',
  model: 'googleai/gemini-2.5-pro', // Using Gemini 2.5 Pro for superior HTML generation
  input: {schema: GenerateNewspaperLayoutInputSchema},
  output: {schema: GenerateNewspaperLayoutOutputSchema},
  prompt: `You are a world-class newspaper layout designer for "The Daily Agent", inspired by the dense, professional, and visually structured layout of "The Times of India". Your task is to generate a complete, multi-page, print-ready HTML layout with a STRICT 3-COLUMN GRID LAYOUT.

**CRITICAL: 3-COLUMN LAYOUT REQUIREMENTS - MUST FOLLOW EXACTLY:**
1.  **ALWAYS USE 3 COLUMNS**: The CSS uses \`column-count: 3\` which AUTOMATICALLY creates 3 columns. Your content will flow into 3 columns naturally.
2.  **DO NOT CREATE MANUAL COLUMNS**: Do NOT use div wrappers like \`<div class="col-1">\`. Simply place \`<article class="story">\` elements one after another and the CSS will arrange them into 3 columns.
3.  **MULTIPLE STORIES**: Create 20-25 individual \`<article class="story">\` blocks, each with complete content. The browser will automatically flow them into 3 columns.
4.  **CONTENT LENGTH**: Each story should be 150-300 words. Mix long and short stories for visual variety.
5.  **IMAGES**: Include images (using provided imageUrl) in 60% of stories. Place \`<figure>\` inside the \`<article>\`.

**Strict Layout and Content Instructions:**
1.  **Use the Template Verbatim**: Your output MUST be a single HTML document based on the provided template. Do not change the CSS, fonts, or the overall HTML structure. The CSS explicitly uses a three-column layout (\`column-count: 3;\`). Your content must be structured to fit this.
2.  **Perfect Content Placement & Flow**:
    *   Take the articles provided and place them into the \`<article class="story">\` elements. Text MUST flow naturally from one column to the next.
    *   To make text flow, you must manually split long articles. End one \`<article>\` block with a paragraph like \`<p class="story-continued">Continued on Col. X...</p>\` and start a new \`<article class="story continued">\` block in the next column with the rest of the text.
    *   The **first article** is the lead story and MUST be placed first on Page 1.
    *   **FILL ALL WHITESPACE**: You must arrange articles to fill the columns and pages perfectly, leaving no large empty white spaces. You must truncate or slightly expand article text if necessary to ensure a snug fit. This is critical for a professional look.
    *   For each article, you must populate:
        *   The headline inside the \`<h2>\` tag.
        *   The content inside the \`<p>\` tags. The first paragraph of major stories should start with a bolded city name, like \`<strong>NEW DELHI:</strong>\`.
        *   The image URL inside the \`<img src="...">\` attribute. Use the provided image or a suitable placeholder like \`https://picsum.photos/seed/your-seed/600/400\`.
        *   A short, relevant caption inside the \`<figcaption>\` tag.
    *   Create a relevant, concise "kicker" (e.g., "National Development", "Technology") for each story in the \`<p class="kicker">\` tag.
    *   Create a plausible byline (e.g., "By Staff Reporter | Delhi Bureau") for each story in the \`<p class="byline">\` tag.
3.  **Update Dynamic Fields**:
    *   Set the date in the \`<title>\` and in the \`<div class="masthead-meta">\` to the current date: **${format(new Date(), 'EEEE, MMMM d, yyyy')}**.
    *   Set the Volume number to **{{editionNumber}}**.
    *   Generate a plausible Issue number (e.g., 318) and price (e.g., ₹12).
    *   Increment the Page Number for each new page you create.
4.  **Vary Layouts**: You have creative control over which articles get images and which don't. Use the \`<div class="page-box">\` for "IN BRIEF" summaries to fill small gaps. Use horizontal rules \`<hr>\` to separate smaller stories. The goal is a balanced, visually interesting layout on every single page. Not every story needs an image.
5.  **Final Output**: The final output must be a single, complete HTML string starting with \`<!DOCTYPE html>\` and ending with \`</html>\`. Do not include any markdown, comments, or other text outside of the HTML.

**Article Data to Use:**
{{#each articles}}
  <div class="article-data" style="display: none;">
    <h2>{{headline}}</h2>
    <p>{{content}}</p>
    {{#if imageUrl}}
      <img src="{{{imageUrl}}}" alt="{{headline}}" />
    {{/if}}
  </div>
{{/each}}


**HTML TEMPLATE TO USE:**
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Daily Agent | ${format(new Date(), 'MMMM d, yyyy')} | Indian Edition</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@400;700;900&family=Lora:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --ink: #1a1614;
            --paper: #faf8f3;
            --accent: #c2410c;
            --muted: #78716c;
            --border: #d6d3d1;
            --highlight: #fef3c7;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: 'Merriweather', 'Lora', Georgia, serif;
            background: linear-gradient(180deg, #fafaf9 0%, #f5f5f4 50%, #fafaf9 100%);
            color: var(--ink);
            line-height: 1.75;
            hyphens: auto;
            -webkit-font-smoothing: antialiased;
        }

        .newspaper-shell {
            max-width: 1400px;
            min-width: 1200px;
            margin: 0 auto 6rem;
            padding: 2.5rem 2rem 4rem;
            background: var(--paper);
            box-shadow: 0 20px 60px rgba(26, 22, 20, 0.12);
        }

        .masthead {
            text-align: center;
            border-bottom: 5px double var(--ink);
            border-top: 2px solid var(--ink);
            padding: 1.5rem 0 1.2rem;
            margin-bottom: 2rem;
            position: relative;
        }

        .masthead::before,
        .masthead::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            height: 1px;
            background: var(--ink);
        }

        .masthead::before {
            top: 4px;
        }

        .masthead::after {
            bottom: 4px;
        }

        .nameplate {
            font-family: 'Playfair Display', 'Times New Roman', serif;
            font-size: clamp(3.2rem, 6vw, 5rem);
            font-weight: 900;
            letter-spacing: 0.18rem;
            text-transform: uppercase;
            line-height: 1;
            margin: 0.8rem 0 0.5rem;
        }

        .masthead-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 2rem;
            font-size: 0.92rem;
            color: var(--muted);
            margin-top: 0.8rem;
            font-family: 'Lora', serif;
            font-weight: 500;
        }

        .masthead-nav {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 1.2rem 2rem;
            margin-top: 1.2rem;
            font-size: 0.88rem;
            font-family: 'Lora', serif;
            font-weight: 600;
        }

        .masthead-nav a {
            text-decoration: none;
            color: var(--ink);
            text-transform: uppercase;
            letter-spacing: 0.1rem;
            border-bottom: 2px solid transparent;
            padding-bottom: 0.15rem;
            transition: all 0.2s ease;
        }

        .masthead-nav a:hover,
        .masthead-nav a:focus {
            border-color: var(--accent);
            color: var(--accent);
        }

        .edition {
            display: flex;
            flex-direction: column;
            gap: 3rem;
        }

        .page {
            background: #fffefb;
            border: 1px solid var(--border);
            border-radius: 2px;
            padding: 2rem 2.5rem 3rem;
            box-shadow: 
                0 1px 3px rgba(26, 22, 20, 0.06),
                0 10px 30px rgba(26, 22, 20, 0.08);
            column-count: 3;
            column-gap: 2.5rem;
            column-fill: auto;
            column-rule: 1px solid var(--border);
            position: relative;
            page-break-inside: avoid;
            min-width: 1100px;
        }

        .page:not(:first-of-type) {
            page-break-before: always;
        }

        .page-heading {
            column-span: all;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 2px solid var(--ink);
            margin-bottom: 1.5rem;
            padding-bottom: 0.6rem;
        }

        .page-label {
            font-family: 'Playfair Display', serif;
            font-size: 0.95rem;
            font-weight: 600;
            letter-spacing: 0.18rem;
            text-transform: uppercase;
            color: var(--ink);
        }

        .page-number {
            font-size: 1.6rem;
            font-weight: 700;
            font-family: 'Playfair Display', serif;
        }

        .story {
            break-inside: avoid-column;
            margin-bottom: 0.8rem;
            font-size: 0.98rem;
        }

        .story.lead {
            margin-bottom: 1rem;
        }

        .story.lead h2 {
            font-size: 2.1rem;
            line-height: 1.1;
            margin: 0.2rem 0 0.4rem;
            font-weight: 900;
        }

        .story h2 {
            font-family: 'Playfair Display', serif;
            font-size: 1.4rem;
            font-weight: 800;
            line-height: 1.2;
            margin: 0.2rem 0 0.3rem;
            color: var(--ink);
        }

        .story.spotlight h2 {
            font-size: 1.6rem;
        }
        
        .kicker {
            text-transform: uppercase;
            letter-spacing: 0.12rem;
            font-size: 0.7rem;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 0.15rem;
            display: block;
            font-family: 'Lora', sans-serif;
        }

        .byline {
            font-style: italic;
            font-size: 0.88rem;
            color: var(--muted);
            margin: 0.1rem 0 0.5rem;
            font-weight: 500;
        }

        p {
            margin: 0 0 0.65rem;
            text-align: justify;
            text-justify: inter-word;
            line-height: 1.65;
        }
        
        p strong {
            font-weight: 700;
        }

        .story-continued {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--accent);
            font-style: italic;
            text-align: right;
            margin: 0.3rem 0;
        }

        .story ul {
            padding-left: 1.2rem;
            margin: 0 0 0.65rem;
            line-height: 1.55;
        }

        .story ul li {
            margin-bottom: 0.3rem;
        }

        .float-media {
            width: 100%;
            margin: 0 0 0.6rem 0;
            position: relative;
        }

        .float-media img {
            width: 100%;
            display: block;
            border: 1px solid var(--border);
            box-shadow: 0 1px 4px rgba(26, 22, 20, 0.08);
        }

        .float-media figcaption {
            font-size: 0.75rem;
            line-height: 1.3;
            color: var(--muted);
            margin-top: 0.3rem;
            font-style: italic;
            padding: 0 0.2rem;
        }
        
        .page-box {
            border: 2px solid var(--ink);
            padding: 0.5rem 0.7rem;
            margin: 0 0 0.8rem 0;
            background: var(--highlight);
            break-inside: avoid;
        }

        .page-box h3 {
            font-family: 'Playfair Display', serif;
            font-size: 1.1rem;
            font-weight: 800;
            margin: 0 0 0.3rem 0;
            text-transform: uppercase;
            letter-spacing: 0.05rem;
        }

        .page-box p {
            margin: 0 0 0.4rem 0;
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .folio {
            text-align: center;
            border-top: 2px solid var(--border);
            padding-top: 2rem;
            margin-top: 2rem;
            font-size: 0.88rem;
            color: var(--muted);
            font-family: 'Lora', serif;
        }

        .folio p {
            margin: 0.3rem 0;
        }

        @media print {
            .page {
                page-break-after: always;
            }
        }

        @media (max-width: 768px) {
            body {
                background: #fffefb;
            }
            .newspaper-shell {
                padding: 1rem;
                box-shadow: none;
            }
            .masthead { padding: 1rem 0 0.8rem; }
            .nameplate { font-size: 2.8rem; }
            .page {
                column-count: 1;
                padding: 1.5rem 1.2rem;
                column-rule: none;
            }
            .page-heading {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.3rem;
            }
            .story h2 { font-size: 1.5rem; }
            .story.lead h2 { font-size: 1.8rem; }
        }

        @media print {
            body { background: white; }
            .newspaper-shell { max-width: 100%; box-shadow: none; }
            .page { page-break-after: always; box-shadow: none; }
            .masthead-nav { display: none; }
        }
    </style>
</head>
<body>
    <div class="newspaper-shell">
        <header class="masthead">
            <div class="nameplate">The Daily Agent</div>
            <div class="masthead-meta">
                <span>${format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
                <span>Indian Edition</span>
                <span>Vol. {{editionNumber}}, No. 1</span>
            </div>
            <nav class="masthead-nav">
                <a href="#page-1">Front Page</a>
            </nav>
        </header>

        <main class="edition">
            <!-- AI will generate all pages dynamically starting here. The AI MUST replace the content below with the articles provided. -->
            <!-- EXAMPLE PAGE 1 LAYOUT (for AI reference) -->
            <section class="page" id="page-1">
                <div class="page-heading">
                    <div class="page-label">Page 1 • Front Page</div>
                    <div class="page-number">1</div>
                </div>
                <article class="story lead">
                    <p class="kicker">LEAD STORY KICKER</p>
                    <h2>Lead Story Headline: To Be Replaced</h2>
                    <p class="byline">By AI Correspondent</p>
                    <figure class="float-media">
                        <img src="https://picsum.photos/seed/leadstory/800/500" alt="Lead story image." />
                        <figcaption>A descriptive caption for the lead story's image.</figcaption>
                    </figure>
                    <p><strong>CITY:</strong> This is the lead story. It must be long and detailed, flowing naturally across columns. The AI will replace this with the actual content from the first article provided. This first paragraph should set the stage, starting with a bolded city name.</p>
                    <p>Subsequent paragraphs will continue to flesh out the details. To make this story flow into the next column, the AI must split the content. It should end this article block here...</p>
                    <p class="story-continued">Continued on Col. 2</p>
                </article>

                <article class="story continued">
                    <p>...and begin a new article block like this one in the next column. This ensures content wraps correctly. The AI must manage this splitting and continuation for all long articles to ensure there is no empty white space on any page. The layout must be dense and full.</p>
                </article>

                <div class="page-box">
                    <h3>IN BRIEF</h3>
                    <p><strong>Item 1:</strong> A short news brief goes here to fill space.</p>
                    <p><strong>Item 2:</strong> Another brief news item for balance.</p>
                </div>

                <article class="story">
                    <p class="kicker">Secondary Story</p>
                    <h2>Secondary Article Headline</h2>
                    <p class="byline">By Staff Writer</p>
                    <p><strong>CITY:</strong> This is a shorter story that might fit in a single column. The AI will populate this with content from other articles. It can choose to include an image or not, depending on what creates a better layout.</p>
                </article>
            </section>
             <!-- AI will generate more pages as needed -->
        </main>

        <footer class="folio">
            <p>&copy; ${new Date().getFullYear()} The Daily Agent. Reproductions by permission only.</p>
            <p>For news tips: newsroom@dailyagent.press | Subscribe at DailyAgent.press/subscribe</p>
        </footer>
    </div>
</body>
</html>
`
});

const generateNewspaperLayoutFlow = ai.defineFlow(
  {
    name: 'generateNewspaperLayoutFlow',
    inputSchema: GenerateNewspaperLayoutInputSchema,
    outputSchema: GenerateNewspaperLayoutOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("The AI failed to generate a newspaper layout.");
    }
    return output;
  }
);
