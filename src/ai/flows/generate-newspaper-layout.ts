
'use server';

/**
 * @fileOverview NEW Modern colorful newspaper layout generator with category-based pages
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
      category: z.string().optional(),
      kicker: z.string().optional(),
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
  model: 'googleai/gemini-2.5-pro',
  input: {schema: GenerateNewspaperLayoutInputSchema},
  output: {schema: GenerateNewspaperLayoutOutputSchema},
}, async (input) => {
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');
  const currentYear = new Date().getFullYear();
  
  // Group articles by category for better organization
  const categorizedArticles = input.articles.reduce((acc, article, idx) => {
    const cat = article.category || 'National';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...article, index: idx + 1 });
    return acc;
  }, {} as Record<string, Array<any>>);
  
  const articlesText = input.articles.map((article, idx) => `
Article ${idx + 1}:
- Headline: ${article.headline}
- Category: ${article.category || 'National'}
- Kicker: ${article.kicker || article.category || 'News'}
- Content: ${article.content}
${article.imageUrl ? `- Image: ${article.imageUrl}` : '- Image: Use relevant Unsplash image'}
`).join('\n');

  const categoryList = Object.keys(categorizedArticles).join(', ');

  return {
    messages: [{
      role: 'user',
      content: [{
        text: `You are a world-class newspaper layout designer for "The Daily Agent", creating a MODERN, COLORFUL Indian newspaper edition.

**YOUR CRITICAL TASK:**
1. Identify the MOST IMPORTANT/BREAKING story for the HERO/LEAD position on Page 1
2. Create SEPARATE PAGES for major categories: National, Politics, Business, Technology, Sports, Science, Culture
3. Use the MODERN COLORFUL TEMPLATE with gradients, colored section headers, and enhanced typography
4. Distribute articles across 5-7 pages based on their categories
5. Page 1 has THE BIGGEST BREAKING STORY as hero with large headline and image

**ARTICLE DISTRIBUTION STRATEGY:**
- **Page 1 (Front Page)**: Hero story + 2-3 other major stories from different categories
- **Page 2 (National/Politics)**: National and Political news
- **Page 3 (Business/Economy)**: Business, Markets, Economic news
- **Page 4 (Technology/Science)**: Technology, Science, Innovation, Environment
- **Page 5 (Sports/Culture)**: Sports, Entertainment, Culture
- **Page 6 (Regional/Opinion)**: Remaining stories, editorials, lifestyle

**MODERN DESIGN REQUIREMENTS:**
1. Use colorful gradient headers for each page:
   - Front Page: Red gradient (--accent)
   - National/Politics: Purple gradient (--accent-purple)
   - Business: Green gradient (--accent-green)
   - Technology: Blue gradient (--accent-blue)
   - Sports/Culture: Orange gradient (--accent-orange)

2. Hero story on Page 1 MUST have:
   - Large prominent headline (3.8rem font)
   - Full-width or half-page image
   - 300-400 word detailed content
   - Breaking Development kicker in red

3. Use varied article components:
   - Quote boxes for impactful statements
   - Stat boxes for key numbers/statistics
   - Info boxes for additional context
   - News briefs sidebar for quick updates

4. Each article needs:
   - Colored kicker badge matching section
   - Strong headline
   - Byline with location
   - Well-structured paragraphs starting with <strong>CITY:</strong>
   - Images in ~50% of articles

5. Use 3-column grid layout per page (automatically handled by CSS)

**PROVIDED ARTICLES (${input.articles.length} total):**
${articlesText}

**Categories Present:** ${categoryList}

**CRITICAL OUTPUT REQUIREMENTS:**
- Complete HTML from <!DOCTYPE html> to </html>
- NO markdown, NO code blocks, NO ``` markers
- Use EXACT modern template provided below
- Create 5-7 <section class="page"> elements
- First article on Page 1 MUST use hero-story class
- Each page has colored header with page title and number
- Update page colors, titles, and numbers for each section
- Use current date: ${currentDate}
- Edition: ${input.editionNumber}

**MODERN HTML TEMPLATE - USE THIS EXACTLY:**
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Daily Agent | ${currentDate} | Modern Edition</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@400;700;900&family=Lora:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&display=swap" rel="stylesheet">
    <style>
        :root {
            --ink: #000000;
            --paper: #ffffff;
            --accent: #d32f2f;
            --accent-blue: #1976d2;
            --accent-green: #388e3c;
            --accent-orange: #f57c00;
            --accent-purple: #7b1fa2;
            --muted: #666666;
            --border: #e0e0e0;
            --highlight: #fff9c4;
            --highlight-blue: #e3f2fd;
            --highlight-green: #e8f5e9;
            --highlight-orange: #fff3e0;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Merriweather', Georgia, serif;
            background: #f5f5f5;
            color: var(--ink);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        .newspaper-shell {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0;
            background: var(--paper);
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.1);
        }

        .masthead {
            text-align: center;
            padding: 2.5rem 2rem 1.5rem;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            position: relative;
            border-bottom: 6px solid var(--ink);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .masthead::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent) 0%, var(--accent-blue) 25%, var(--accent-green) 50%, var(--accent-orange) 75%, var(--accent-purple) 100%);
        }

        .nameplate {
            font-family: 'Bebas Neue', 'Playfair Display', serif;
            font-size: clamp(4rem, 8vw, 7rem);
            font-weight: 900;
            letter-spacing: 0.25rem;
            text-transform: uppercase;
            line-height: 1;
            margin: 0 0 0.5rem;
            background: linear-gradient(135deg, var(--ink) 0%, #333 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .masthead-meta {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 2rem;
            font-size: 0.95rem;
            color: var(--muted);
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            margin-bottom: 1.2rem;
        }

        .masthead-nav {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 0.5rem;
            font-size: 0.85rem;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            padding-top: 1.2rem;
            border-top: 2px solid var(--border);
        }

        .masthead-nav a {
            text-decoration: none;
            color: var(--paper);
            text-transform: uppercase;
            letter-spacing: 0.08rem;
            transition: all 0.3s ease;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            background: var(--ink);
        }

        .masthead-nav a:hover {
            background: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .edition { padding: 0; }

        .page {
            background: var(--paper);
            padding: 0;
            position: relative;
            margin-bottom: 3rem;
            page-break-after: always;
            break-after: page;
        }

        .page-header {
            background: linear-gradient(135deg, var(--accent) 0%, var(--accent-purple) 100%);
            color: var(--paper);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'Inter', sans-serif;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .page-header.blue { background: linear-gradient(135deg, var(--accent-blue) 0%, #1565c0 100%); }
        .page-header.green { background: linear-gradient(135deg, var(--accent-green) 0%, #2e7d32 100%); }
        .page-header.orange { background: linear-gradient(135deg, var(--accent-orange) 0%, #ef6c00 100%); }
        .page-header.purple { background: linear-gradient(135deg, var(--accent-purple) 0%, #6a1b9a 100%); }
        .page-header.red { background: linear-gradient(135deg, var(--accent) 0%, #c62828 100%); }

        .page-title { font-size: 1.3rem; }
        .page-num { font-size: 1.5rem; font-weight: 900; }

        .page-content {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 2rem;
            padding: 2rem;
        }

        .hero-section {
            grid-column: 1 / 3;
            border-right: 1px solid var(--border);
            padding-right: 2rem;
        }

        .sidebar-section { grid-column: 3 / 4; }

        .secondary-stories {
            grid-column: 1 / 4;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            border-top: 2px solid var(--ink);
            padding-top: 2rem;
            margin-top: 2rem;
        }

        .three-column-layout {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            padding: 2rem;
        }

        .hero-story { margin-bottom: 2rem; }

        .hero-story .kicker {
            text-transform: uppercase;
            letter-spacing: 0.15rem;
            font-size: 0.8rem;
            font-weight: 800;
            color: var(--paper);
            margin-bottom: 0.6rem;
            display: inline-block;
            font-family: 'Inter', sans-serif;
            background: var(--accent);
            padding: 0.4rem 1rem;
            border-radius: 4px;
            box-shadow: 0 2px 6px rgba(211, 47, 47, 0.3);
        }

        .hero-story h1 {
            font-family: 'Playfair Display', serif;
            font-size: clamp(2.5rem, 4vw, 3.8rem);
            font-weight: 900;
            line-height: 1.1;
            margin: 0 0 1rem;
            color: var(--ink);
        }

        .hero-story .byline {
            font-style: italic;
            font-size: 0.95rem;
            color: var(--muted);
            margin: 0 0 1.5rem;
            font-weight: 500;
            font-family: 'Inter', sans-serif;
        }

        .hero-image {
            width: 100%;
            margin: 0 0 1rem;
        }

        .hero-image img {
            width: 100%;
            height: auto;
            display: block;
            border: 1px solid var(--border);
        }

        .hero-image figcaption {
            font-size: 0.85rem;
            line-height: 1.4;
            color: var(--muted);
            margin-top: 0.5rem;
            font-style: italic;
        }

        .hero-story .lead-text {
            font-size: 1.2rem;
            font-weight: 600;
            line-height: 1.6;
            margin-bottom: 1.2rem;
            color: var(--ink);
        }

        .hero-story p {
            font-size: 1rem;
            line-height: 1.75;
            margin: 0 0 1rem;
            text-align: justify;
            font-family: 'Merriweather', Georgia, serif;
        }

        .story { margin-bottom: 2rem; }

        .story .kicker {
            text-transform: uppercase;
            letter-spacing: 0.12rem;
            font-size: 0.7rem;
            font-weight: 800;
            color: var(--paper);
            margin-bottom: 0.3rem;
            display: inline-block;
            font-family: 'Inter', sans-serif;
            background: var(--accent);
            padding: 0.25rem 0.6rem;
            border-radius: 3px;
        }

        .story .kicker.blue { background: var(--accent-blue); }
        .story .kicker.green { background: var(--accent-green); }
        .story .kicker.orange { background: var(--accent-orange); }
        .story .kicker.purple { background: var(--accent-purple); }

        .story h2 {
            font-family: 'Playfair Display', serif;
            font-size: 1.5rem;
            font-weight: 800;
            line-height: 1.2;
            margin: 0 0 0.5rem;
            color: var(--ink);
        }

        .story .byline {
            font-style: italic;
            font-size: 0.85rem;
            color: var(--muted);
            margin: 0 0 0.8rem;
            font-weight: 500;
            font-family: 'Inter', sans-serif;
        }

        .story p {
            font-size: 0.95rem;
            line-height: 1.65;
            margin: 0 0 0.8rem;
            text-align: justify;
            font-family: 'Merriweather', Georgia, serif;
        }

        .story-image {
            width: 100%;
            margin: 0 0 0.8rem;
        }

        .story-image img {
            width: 100%;
            height: auto;
            display: block;
            border: 1px solid var(--border);
        }

        .story-image figcaption {
            font-size: 0.8rem;
            color: var(--muted);
            margin-top: 0.4rem;
            font-style: italic;
        }

        .quote-box {
            border-left: 6px solid var(--accent);
            padding: 1.2rem 1.8rem;
            margin: 1.5rem 0;
            background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
            font-style: italic;
            border-radius: 0 8px 8px 0;
            box-shadow: 0 3px 10px rgba(211, 47, 47, 0.15);
        }

        .quote-box p {
            font-size: 1.15rem;
            line-height: 1.65;
            margin: 0 0 0.6rem;
            font-weight: 500;
        }

        .quote-box cite {
            font-size: 0.95rem;
            font-style: normal;
            color: var(--accent);
            font-weight: 700;
        }

        .stat-box {
            background: linear-gradient(135deg, var(--highlight-blue) 0%, #bbdefb 100%);
            border: 3px solid var(--accent-blue);
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1.5rem 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
        }

        .stat-box .stat-number {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 3rem;
            font-weight: 900;
            color: var(--accent-blue);
            line-height: 1;
            margin-bottom: 0.5rem;
        }

        .stat-box .stat-label {
            font-family: 'Inter', sans-serif;
            font-size: 0.95rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08rem;
            color: var(--ink);
        }

        .info-box {
            background: linear-gradient(135deg, var(--highlight-green) 0%, #c8e6c9 100%);
            border: 3px solid var(--accent-green);
            border-radius: 8px;
            padding: 1.2rem;
            margin: 1.5rem 0;
            box-shadow: 0 4px 12px rgba(56, 142, 60, 0.2);
        }

        .info-box h4 {
            font-family: 'Inter', sans-serif;
            font-size: 1rem;
            font-weight: 800;
            text-transform: uppercase;
            color: var(--accent-green);
            margin: 0 0 0.8rem;
        }

        .news-brief {
            background: linear-gradient(135deg, var(--highlight) 0%, #fff8dc 100%);
            border: 3px solid var(--accent-orange);
            border-left: 8px solid var(--accent-orange);
            padding: 1.2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 12px rgba(245, 124, 0, 0.2);
        }

        .news-brief h3 {
            font-family: 'Inter', sans-serif;
            font-size: 1.1rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12rem;
            margin: 0 0 1rem;
            border-bottom: 3px solid var(--accent-orange);
            padding-bottom: 0.6rem;
            color: var(--accent-orange);
        }

        @media (max-width: 1024px) {
            .page-content, .three-column-layout {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
            .hero-section {
                grid-column: 1 / 2;
                border-right: none;
            }
            .secondary-stories {
                grid-column: 1 / 2;
                grid-template-columns: 1fr;
            }
        }

        @media print {
            .page { page-break-after: always; }
            .masthead-nav { display: none; }
        }
    </style>
</head>
<body>
    <div class="newspaper-shell">
        <header class="masthead">
            <div class="nameplate">THE DAILY AGENT</div>
            <div class="masthead-meta">
                <span>${currentDate}</span>
                <span>|</span>
                <span>Indian Edition</span>
                <span>|</span>
                <span>Vol. ${input.editionNumber} | ₹12</span>
            </div>
            <nav class="masthead-nav">
                <a href="#front">Front Page</a>
                <a href="#national">National</a>
                <a href="#business">Business</a>
                <a href="#technology">Technology</a>
                <a href="#sports">Sports</a>
            </nav>
        </header>

        <main class="edition">
            <!-- AI: CREATE PAGES WITH COLORED HEADERS AND CATEGORIZED ARTICLES -->
            <!-- Page 1: Front page with HERO STORY -->
            <!-- Page 2: National/Politics -->
            <!-- Page 3: Business/Economy -->
            <!-- Page 4: Technology/Science -->
            <!-- Page 5: Sports/Culture -->
            <!-- Page 6+: Remaining stories -->
            
            <!-- REPLACE THIS COMMENT WITH ACTUAL PAGES -->
        </main>
    </div>
</body>
</html>
`
      }]
    }]
  };
});

const generateNewspaperLayoutFlow = ai.defineFlow(
  {
    name: 'generateNewspaperLayoutFlow',
    inputSchema: GenerateNewspaperLayoutInputSchema,
    outputSchema: GenerateNewspaperLayoutOutputSchema,
  },
  async (input) => {
    const result = await prompt(input);
    return result.output!;
  }
);
