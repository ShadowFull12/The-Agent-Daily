
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
  config: {
    // Note: Google Search grounding is only available with Vertex AI plugin
    // The Google AI (Gemini API) plugin does not support the google_search tool
    // However, Gemini 2.5 Pro has knowledge up to early 2024 and can use
    // its training data for reasonable estimates of current information
  },
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
2. Create SEPARATE DEDICATED PAGES for EACH category - DO NOT combine categories on same page
3. Each category gets its OWN page(s) - one category can span MULTIPLE pages if it has many stories
4. Total page count can be 10-15+ pages - use as many as needed to showcase all content beautifully
5. Fill pages completely - avoid white space - distribute articles to maximize visual balance

**CATEGORY PAGE STRATEGY (EACH CATEGORY SEPARATE):**
- **Page 1**: Front Page with HERO breaking story + 3-4 top stories from different categories
- **Pages 2-X**: NATIONAL category only (can be multiple pages if many national stories)
- **Pages X+1-Y**: POLITICS category only (separate from national)
- **Pages Y+1-Z**: BUSINESS category only  
- **Next Pages**: TECHNOLOGY category only (separate from science)
- **Next Pages**: SCIENCE category only (separate from technology)
- **Next Pages**: SPORTS category only (separate from culture)
- **Next Pages**: CULTURE/Entertainment category only
- **Next Pages**: HEALTHCARE category only
- **Next Pages**: ENVIRONMENT category only
- **Final Pages**: Any remaining categories or opinion/lifestyle

**IMPORTANT RULES - NO WHITE SPACE:**
- NEVER combine categories like "National & Politics" or "Technology & Science" - they must be SEPARATE pages
- One category can have 2-3 pages if there are 8+ articles in that category
- ALL PAGES MUST BE EQUAL LENGTH - use CSS to ensure consistent page heights
- When articles DON'T divide by 3 evenly on a page:
  * Make 1-2 articles span 2 columns to fill horizontal space
  * OR expand one article's content across multiple columns
  * OR add quote boxes, stat boxes to balance the layout
- For longer articles (400+ words): Split content across 2 columns using CSS column-span
- Add quote boxes, stat boxes, news briefs ONLY when needed to fill white space
- Total edition can easily be 10-15 pages - this is GOOD and expected
- Every page should look visually balanced and full

**MODERN DESIGN REQUIREMENTS:**
1. **Page Layout - CRITICAL FOR NO WHITE SPACE:**
   - Use 3-column grid (three-column-layout class)
   - If page has 4 stories: Make 1 story span 2 columns
   - If page has 5 stories: Make 2 stories span 2 columns, rest single column
   - If page has 7 stories: Make 1 story span 2 columns
   - Long articles (400+ words): Use CSS column-count: 2 to split within story
   - All pages MUST have equal heights using min-height and page-break

2. **Colored gradient headers** for each page (match to category):
   - Front Page: Red gradient (.page-header.red)
   - National: Purple gradient (.page-header.purple)
   - Politics: Deep Purple gradient (.page-header.purple)
   - Business: Green gradient (.page-header.green)
   - Technology: Blue gradient (.page-header.blue)
   - Science: Teal/Blue gradient (.page-header.blue)
   - Sports: Orange gradient (.page-header.orange)
   - Culture: Pink/Orange gradient (.page-header.orange)
   - Healthcare: Green gradient (.page-header.green)
   - Environment: Green gradient (.page-header.green)

3. **Hero story on Page 1** MUST have:
   - Large prominent headline (3.8rem font)
   - Full-width image in hero-image class
   - 350-450 word detailed content
   - Breaking Development kicker in red

4. **Component Sizing - FIT TO CONTENT:**
   - Quote boxes: Only 2-3 lines of text, compact padding (0.8rem)
   - Stat boxes: Large number + short label, tight spacing
   - Info boxes: 3-4 bullet points maximum, compact
   - News briefs: 4-5 one-line items, minimal padding
   - DO NOT make boxes overly large - they should enhance, not dominate

5. **Each article needs:**
   - Colored kicker badge matching section
   - Strong headline (h2 or h3)
   - Byline with reporter name and location
   - Well-structured paragraphs starting with <strong>CITY:</strong>
   - Images in ~60% of articles (use story-image class)

6. **SUPPLEMENTARY CONTENT - Fill Empty Spaces with Daily Information:**
   When pages have white space or need additional content to reach equal heights, ADD these components:
   
   **Market & Economy Widgets:**
   - Stock Market Update (Sensex, Nifty with today's closing prices and % change)
   - Cryptocurrency Prices (Bitcoin, Ethereum current values)
   - Currency Exchange Rates (USD, EUR, GBP to INR)
   - Gold & Silver Prices (22K, 24K per 10g in major cities)
   - Crude Oil Prices (Brent, WTI current rates)
   
   **Daily Essentials (Use Today's Date - ${currentDate}):**
   - Fuel Prices: Petrol & Diesel in Mumbai, Delhi, Bangalore, Kolkata, Chennai
   - Weather Forecast: Temperature, conditions for major metros
   - Sunrise/Sunset Times for Indian cities
   - Moon Phase for today
   
   **Entertainment & Culture:**
   - New Films Releasing This Week (Bollywood & Hollywood)
   - Trending on OTT Platforms (Netflix, Prime, Hotstar)
   - Book Recommendations / Bestseller List
   - Music Chart Toppers
   
   **Daily Features:**
   - Quote of the Day (inspirational/famous quotes)
   - Historical Events - "On This Day" (${currentDate})
   - Word of the Day with definition
   - Fun Fact of the Day
   - Trivia Question
   - Puzzle Corner (Quick Sudoku or Crossword clue)
   
   **Sports Scoreboard:**
   - Cricket Scores (IPL, International matches)
   - Football Scores (ISL, EPL, La Liga)
   - Tennis Rankings
   - Olympics/Asian Games Updates if ongoing
   
   **Lifestyle Snippets:**
   - Health Tip of the Day
   - Recipe Corner (Quick Indian recipe)
   - Tech Tip of the Day
   - Fashion Trend Alert
   - Fitness Challenge
   
   **IMPORTANT - DATA APPROACH:**
   NOTE: Real-time Google Search grounding is NOT available in the Google AI plugin (only in Vertex AI).
   Instead, use your training knowledge and general patterns to create PLAUSIBLE supplementary content:
   
   - **Fuel Prices:** Use typical ranges: Mumbai ₹105-107, Delhi ₹95-98, Bangalore ₹101-103, Chennai ₹102-104, Kolkata ₹104-106
   - **Market Data:** Use trending patterns: Sensex ~82,000-83,000, Nifty ~25,000-25,200, Gold ₹72,000-73,000/10g
   - **Weather:** Use seasonal typical values (Winter: 18-28°C, Summer: 32-42°C, Monsoon: 24-30°C) based on city and ${currentDate}
   - **Entertainment:** Reference general knowledge of recent/upcoming releases, popular streaming content
   - **Sports:** Use typical score formats and realistic team matchups
   
   Focus on creating PROFESSIONAL-LOOKING widgets with plausible data that demonstrates excellent newspaper design.
   The goal is visual quality and layout excellence, not real-time accuracy.
   
   **Implementation:**
   - Place 2-3 of these widgets on EVERY page to fill space
   - Use appropriate colored boxes (info-box, stat-box, news-brief classes)
   - Keep them compact (3-5 items per widget)
   - Match widget theme to page category when possible (stocks on Business page, movie releases on Culture page)
   - These widgets make newspaper feel comprehensive and daily-relevant

7. **Modern Aesthetic:**
   - Consistent spacing and rhythm
   - Balanced visual weight across columns
   - Clean typography with proper hierarchy
   - Professional color palette throughout
   - Equal page lengths with proper page breaks
   - Pages feel full and information-rich, never sparse

**PROVIDED ARTICLES (${input.articles.length} total):**
${articlesText}

**Categories Present:** ${categoryList}

**CRITICAL OUTPUT REQUIREMENTS:**
- Complete HTML from <!DOCTYPE html> to </html>
- NO markdown formatting, NO code blocks
- Use EXACT modern template provided below
- Create 10-15+ pages with <section class="page"> elements as needed
- Each category gets dedicated page(s) - NEVER mix categories on same page
- ALL PAGES MUST BE EQUAL HEIGHT (min-height: 1400px)
- First article on Page 1 MUST use hero-story class
- Each page has colored header with page title and number
- Page titles should be single category name (e.g., "National News", "Politics", "Business & Markets", "Technology")
- Update page colors, titles, and numbers for each section
- Use current date: ${currentDate}
- Edition: ${input.editionNumber}

**WHITE SPACE ELIMINATION STRATEGY:**
When a page has articles that don't divide evenly by 3:
- 4 articles: Add class="span-2" to 1 article to make it wider
- 5 articles: Add class="span-2" to 2 articles
- 7 articles: Add class="span-2" to 1 article
- Long article (400+ words): Add class="multi-column" to split text into 2 columns
- Use compact quote/stat/info boxes (2-3 lines max) to fill remaining gaps
- Example: <article class="story span-2 multi-column">...</article>

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
            min-height: 1400px; /* Equal page heights */
            display: flex;
            flex-direction: column;
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
            flex: 1; /* Fill available space */
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
            flex: 1; /* Fill available space */
            align-content: start;
        }

        /* Multi-column story support for filling space */
        .story.span-2 {
            grid-column: span 2; /* Spans 2 columns */
        }

        .story.multi-column {
            column-count: 2;
            column-gap: 1.5rem;
            column-rule: 1px solid var(--border);
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
            padding: 0.8rem 1.2rem; /* Compact padding */
            margin: 1rem 0;
            background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
            font-style: italic;
            border-radius: 0 8px 8px 0;
            box-shadow: 0 3px 10px rgba(211, 47, 47, 0.15);
        }

        .quote-box p {
            font-size: 1rem; /* Reduced from 1.15rem */
            line-height: 1.5;
            margin: 0 0 0.4rem;
            font-weight: 500;
        }

        .quote-box cite {
            font-size: 0.85rem;
            font-style: normal;
            color: var(--accent);
            font-weight: 700;
        }

        .stat-box {
            background: linear-gradient(135deg, var(--highlight-blue) 0%, #bbdefb 100%);
            border: 3px solid var(--accent-blue);
            border-radius: 8px;
            padding: 1rem 1.2rem; /* Compact padding */
            margin: 1rem 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
        }

        .stat-box .stat-number {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 2.5rem; /* Reduced from 3rem */
            font-weight: 900;
            color: var(--accent-blue);
            line-height: 1;
            margin-bottom: 0.3rem;
        }

        .stat-box .stat-label {
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem; /* Reduced from 0.95rem */
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08rem;
            color: var(--ink);
        }

        .info-box {
            background: linear-gradient(135deg, var(--highlight-green) 0%, #c8e6c9 100%);
            border: 3px solid var(--accent-green);
            border-radius: 8px;
            padding: 0.8rem 1rem; /* Compact padding */
            margin: 1rem 0;
            box-shadow: 0 4px 12px rgba(56, 142, 60, 0.2);
        }

        .info-box h4 {
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem; /* Reduced from 1rem */
            font-weight: 800;
            text-transform: uppercase;
            color: var(--accent-green);
            margin: 0 0 0.5rem;
        }

        .news-brief {
            background: linear-gradient(135deg, var(--highlight) 0%, #fff8dc 100%);
            border: 3px solid var(--accent-orange);
            border-left: 8px solid var(--accent-orange);
            padding: 0.8rem 1rem; /* Compact padding */
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 12px rgba(245, 124, 0, 0.2);
        }

        .news-brief h3 {
            font-family: 'Inter', sans-serif;
            font-size: 1rem; /* Reduced from 1.1rem */
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12rem;
            margin: 0 0 0.6rem;
            border-bottom: 3px solid var(--accent-orange);
            padding-bottom: 0.4rem;
            color: var(--accent-orange);
        }
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
            
            <!-- SUPPLEMENTARY WIDGET TEMPLATES - Use plausible values based on training knowledge -->
            <!-- NOTE: Google Search grounding is only available in Vertex AI plugin, not Google AI plugin -->
            <!-- Create professional-looking widgets with realistic data based on typical patterns -->
            
            <!-- EXAMPLE: Market Data Widget (Use on Business page) -->
            <!-- <div class="info-box">
                <h4>Market Watch</h4>
                <div class="stat-box">
                    <div class="stat-number">82,347</div>
                    <div class="stat-label">Sensex ▲ 1.2%</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">25,184</div>
                    <div class="stat-label">Nifty 50 ▲ 0.8%</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">₹73.2</div>
                    <div class="stat-label">Gold (10g) ▼ 0.3%</div>
                </div>
            </div> -->
            
            <!-- EXAMPLE: Fuel Prices Widget (Use on any page) -->
            <!-- <div class="info-box">
                <h4>Today's Fuel Prices</h4>
                <p><strong>Mumbai:</strong> Petrol ₹106.31/L | Diesel ₹94.27/L</p>
                <p><strong>Delhi:</strong> Petrol ₹96.72/L | Diesel ₹89.62/L</p>
                <p><strong>Bangalore:</strong> Petrol ₹101.94/L | Diesel ₹87.89/L</p>
                <p><strong>Chennai:</strong> Petrol ₹102.63/L | Diesel ₹94.24/L</p>
                <p><strong>Kolkata:</strong> Petrol ₹106.03/L | Diesel ₹92.76/L</p>
            </div> -->
            
            <!-- EXAMPLE: Weather Widget (Use on Front or National page) -->
            <!-- <div class="info-box">
                <h4>Today's Weather</h4>
                <p><strong>Mumbai:</strong> 32°C | Partly Cloudy | Humidity 78%</p>
                <p><strong>Delhi:</strong> 28°C | Clear | Humidity 45%</p>
                <p><strong>Bangalore:</strong> 26°C | Light Rain | Humidity 82%</p>
                <p><strong>Sunrise:</strong> 6:42 AM | <strong>Sunset:</strong> 6:18 PM</p>
            </div> -->
            
            <!-- EXAMPLE: New Films Releasing Widget (Use on Culture/Entertainment page) -->
            <!-- <div class="info-box">
                <h4>New Releases This Week</h4>
                <p><strong>Cinemas:</strong> "Fighter" (Action), "Teri Baaton Mein Aisa Uljha Jiya" (Romance)</p>
                <p><strong>OTT:</strong> "Ghazi" (Netflix), "Murder Mubarak" (Prime Video)</p>
                <p><strong>Books:</strong> "The Women" by Kristin Hannah, "Holly" by Stephen King</p>
                <p><strong>Music:</strong> Top Chart - "Apna Bana Le" | Arijit Singh</p>
            </div> -->
            
            <!-- EXAMPLE: Quote of the Day Widget -->
            <!-- <div class="quote-box">
                <div class="quote-text">"The only way to do great work is to love what you do."</div>
                <div class="quote-author">— Steve Jobs</div>
            </div> -->
            
            <!-- EXAMPLE: Historical Events Widget -->
            <!-- <div class="info-box">
                <h4>On This Day in History</h4>
                <p><strong>1947:</strong> India gains independence from British rule</p>
                <p><strong>1969:</strong> First human landing on the Moon</p>
                <p><strong>2008:</strong> Barack Obama elected as first African American President</p>
            </div> -->
            
            <!-- EXAMPLE: Sports Scoreboard Widget (Use on Sports page) -->
            <!-- <div class="info-box">
                <h4>Today's Scores</h4>
                <p><strong>Cricket:</strong> India 342/5 vs Australia (Live)</p>
                <p><strong>Football:</strong> Manchester United 2-1 Chelsea (FT)</p>
                <p><strong>Tennis:</strong> Djokovic def. Alcaraz 6-4, 7-6</p>
            </div> -->
            
            <!-- EXAMPLE: Cryptocurrency Prices Widget (Use on Business/Tech page) -->
            <!-- <div class="info-box">
                <h4>Crypto Market</h4>
                <div class="stat-box">
                    <div class="stat-number">₹45.2L</div>
                    <div class="stat-label">Bitcoin ▲ 2.1%</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">₹1.98L</div>
                    <div class="stat-label">Ethereum ▲ 1.8%</div>
                </div>
            </div> -->
            
            <!-- EXAMPLE: Lifestyle/Health Tip Widget -->
            <!-- <div class="news-brief">
                <h4>Health Tip of the Day</h4>
                <p>Start your morning with warm lemon water to boost metabolism and aid digestion. Add a pinch of turmeric for anti-inflammatory benefits.</p>
            </div> -->
            
            <!-- EXAMPLE: Word of the Day Widget -->
            <!-- <div class="quote-box">
                <div class="quote-text"><strong>Word of the Day:</strong> Serendipity</div>
                <div class="quote-author">Finding something good without looking for it</div>
            </div> -->
            
            <!-- EXAMPLE: Tech Tip Widget (Use on Technology page) -->
            <!-- <div class="news-brief">
                <h4>Tech Tip</h4>
                <p>Enable two-factor authentication on all your accounts. Use authenticator apps like Google Authenticator instead of SMS for better security.</p>
            </div> -->
            
            <!-- EXAMPLE: Trivia Widget -->
            <!-- <div class="info-box">
                <h4>Did You Know?</h4>
                <p>India is the world's largest producer of milk, spices, and pulses. The country has over 1.4 billion people speaking more than 19,500 languages and dialects.</p>
            </div> -->
            
            <!-- AI: Use these templates as examples. Place 2-3 widgets on EVERY page. -->
            <!-- NOTE: Google Search grounding is NOT available in Google AI plugin (only Vertex AI). -->
            <!-- Use plausible values based on training knowledge and typical patterns for ${currentDate}. -->
            <!-- Match widget themes to page categories (stocks on Business, movies on Culture). -->
            
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
