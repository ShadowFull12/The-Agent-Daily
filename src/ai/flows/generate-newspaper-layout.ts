
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
  prompt: `You are a world-class newspaper layout designer for "The Daily Agent". Your task is to generate a complete HTML newspaper layout.

**🚨 CRITICAL: THE CSS AUTOMATICALLY CREATES 3 COLUMNS 🚨**

The HTML template includes this CSS: \`column-count: 3;\` 
This means the browser will AUTOMATICALLY arrange your content into 3 columns.

**YOUR ONLY JOB: Create 20-30 <article> elements in sequence**

DO THIS:
\`\`\`html
<div class="page">
  <div class="page-heading">...</div>
  <article class="story">Story 1 content (200 words)</article>
  <article class="story">Story 2 content (300 words)</article>
  <article class="story">Story 3 content (150 words)</article>
  <article class="story">Story 4 content (250 words)</article>
  <!-- Keep adding 20-30 articles total -->
</div>
\`\`\`

The CSS will automatically flow these into 3 columns. You don't create columns manually.

**DO NOT DO THIS:**
- ❌ DO NOT create \`<div class="column">\` wrappers
- ❌ DO NOT use CSS Grid/Flexbox for columns
- ❌ DO NOT manually split articles with "Continued on Col. 2"
- ❌ DO NOT create column divs of any kind

**SIMPLE RULES:**
1. Create 20-30 \`<article class="story">\` elements inside each \`<div class="page">\`
2. Each article: 150-400 words (vary lengths for visual interest)
3. Include \`<figure>\` with image in 50% of articles
4. Use ALL provided article data
5. First article = lead story (use class="story lead")

**Article Structure:**
\`\`\`html
<article class="story">
  <p class="kicker">CATEGORY NAME</p>
  <h2>Headline Goes Here</h2>
  <p class="byline">By Reporter Name | Location</p>
  <figure class="float-media">
    <img src="{{imageUrl}}" alt="Description" />
    <figcaption>Image caption here</figcaption>
  </figure>
  <p><strong>CITY:</strong> First paragraph with city name...</p>
  <p>Second paragraph continues story...</p>
  <p>Third paragraph adds more details...</p>
</article>
\`\`\`

**Article Structure:**
\`\`\`html
<article class="story">
  <p class="kicker">CATEGORY NAME</p>
  <h2>Headline Goes Here</h2>
  <p class="byline">By Reporter Name | Location</p>
  <figure class="float-media">
    <img src="{{imageUrl}}" alt="Description" />
    <figcaption>Image caption here</figcaption>
  </figure>
  <p><strong>CITY:</strong> First paragraph with city name...</p>
  <p>Second paragraph continues story...</p>
  <p>Third paragraph adds more details...</p>
</article>
\`\`\`

**Dynamic Fields to Update:**
- Date: ${format(new Date(), 'EEEE, MMMM d, yyyy')}
- Volume: {{editionNumber}}
- Page numbers: 1, 2, 3, etc.

**Use ALL Provided Articles:**
{{#each articles}}
- Headline: {{headline}}
- Content: {{content}}
{{#if imageUrl}}- Image: {{{imageUrl}}}{{/if}}
{{/each}}

Output must be complete HTML from \`<!DOCTYPE html>\` to \`</html>\`. No markdown, no comments outside HTML.


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
            <!-- AI: Replace this section with actual articles. Create 20-30 <article class="story"> elements. -->
            <!-- The CSS column-count:3 will automatically arrange them into 3 columns. -->
            <section class="page" id="page-1">
                <div class="page-heading">
                    <div class="page-label">Page 1 • Front Page</div>
                    <div class="page-number">1</div>
                </div>
                
                <!-- AI: Start with lead story -->
                <article class="story lead">
                    <p class="kicker">CATEGORY</p>
                    <h2>Lead Story Headline</h2>
                    <p class="byline">By Reporter | Location</p>
                    <figure class="float-media">
                        <img src="https://picsum.photos/seed/lead/800/500" alt="Lead image" />
                        <figcaption>Caption for lead story image.</figcaption>
                    </figure>
                    <p><strong>CITY:</strong> Lead story content starts here with 300-400 words...</p>
                </article>

                <!-- AI: Add 19-29 more articles like this -->
                <article class="story">
                    <p class="kicker">CATEGORY</p>
                    <h2>Second Story Headline</h2>
                    <p class="byline">By Reporter | Location</p>
                    <p><strong>CITY:</strong> Story content 200-300 words...</p>
                </article>

                <article class="story">
                    <p class="kicker">CATEGORY</p>
                    <h2>Third Story Headline</h2>
                    <p class="byline">By Reporter | Location</p>
                    <figure class="float-media">
                        <img src="imageUrl" alt="Story image" />
                        <figcaption>Image caption.</figcaption>
                    </figure>
                    <p><strong>CITY:</strong> Story content 150-250 words...</p>
                </article>
                
                <!-- AI: Keep adding more articles until you have 20-30 total -->
            </section>
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
