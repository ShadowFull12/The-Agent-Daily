
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
  prompt: `You are a world-class newspaper layout designer for "The Daily Agent", a prestigious Indian newspaper.

**YOUR TASK:** Generate a complete newspaper edition using the provided template below. Follow these rules EXACTLY:

**CRITICAL RULES:**
1. Use the EXACT HTML template structure provided below
2. The CSS \`column-count: 3\` automatically creates 3 columns - DO NOT create manual column divs
3. Create 20-30 <article class="story"> elements in sequence - CSS will flow them into columns
4. First article MUST use class="story lead" for prominence
5. Vary article lengths: 150-400 words for visual balance
6. Include images (using provided imageUrl) in approximately 50% of articles
7. Use ALL provided articles - expand content to 150-400 words per article if needed
8. Use Indian cities, reporter names, and local context
9. Each article needs: kicker (category), headline, byline, content paragraphs
10. Start paragraphs with <strong>CITY:</strong> format

**Article Structure Pattern:**
\`\`\`html
<article class="story">
  <p class="kicker">Technology</p>
  <h2>Article Headline Here</h2>
  <p class="byline">By Priya Sharma | Mumbai Bureau</p>
  <figure class="float-media">
    <img src="IMAGE_URL_HERE" alt="Description" />
    <figcaption>Brief image caption explaining the photo.</figcaption>
  </figure>
  <p><strong>MUMBAI:</strong> Opening paragraph with key information...</p>
  <p>Second paragraph expanding on the story...</p>
  <p>Additional context and details...</p>
</article>
\`\`\`

**Provided Articles to Use:**
${input.articles.map((article, idx) => `
Article ${idx + 1}:
- Headline: ${article.headline}
- Content: ${article.content}
${article.imageUrl ? `- Image: ${article.imageUrl}` : '- Image: Use placeholder from unsplash.com'}
`).join('\n')}

**Categories to Use:** National Development, Technology, Politics, Business, Markets, Sports, Culture, Science, Environment, Education, Agriculture, Infrastructure, Policy Watch

**Output Requirements:**
- Complete HTML from <!DOCTYPE html> to </html>
- NO markdown formatting, NO code blocks, NO comments
- Use current date: ${format(new Date(), 'EEEE, MMMM d, yyyy')}
- Edition number: ${input.editionNumber}
- Replace ALL placeholder content with actual articles
- Create exactly ONE page with 20-30 articles


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
            column-gap: 3.2rem;
            column-fill: balance;
            column-rule: 1px solid var(--border);
            position: relative;
            page-break-inside: avoid;
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

        @media (max-width: 1180px) {
            .page {
                column-count: 2;
                column-gap: 2.5rem;
                padding: 2rem;
            }

            .float-media,
            .story.lead .float-media {
                width: 100%;
                float: none;
                margin: 0 0 1.2rem;
            }

            .story.lead {
                column-span: none;
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
