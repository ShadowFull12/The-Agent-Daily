
'use server';

/**
 * @fileOverview NEW Modern colorful newspaper layout generator with category-based pages
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { format } from 'date-fns';
import { webSearchToolImplementation } from '@/ai/tools/web-search-tool';


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
  sportsBoxes: z.array(z.object({
    sport: z.string(),
    title: z.string(),
    content: z.string(),
    type: z.string(),
  })).optional().describe('Pre-generated sports data boxes from Sports Journalist'),
});

export type GenerateNewspaperLayoutInput = z.infer<typeof GenerateNewspaperLayoutInputSchema>;

const GenerateNewspaperLayoutOutputSchema = z.object({
  html: z.string().describe('The HTML string for the entire newspaper layout.'),
});

export type GenerateNewspaperLayoutOutput = z.infer<typeof GenerateNewspaperLayoutOutputSchema>;

export async function generateNewspaperLayout(input: GenerateNewspaperLayoutInput): Promise<GenerateNewspaperLayoutOutput> {
  return generateNewspaperLayoutFlow(input);
}

// Define and export the web search tool for real-time data
export const webSearchTool = ai.defineTool(
  {
    name: 'webSearch',
    description: 'Search the web for current, real-time information including stock prices, fuel prices, weather, news, entertainment releases, and sports scores. Use this when you need up-to-date factual information that may have changed recently.',
    inputSchema: z.object({
      query: z.string().describe('The search query. Be specific about what information you need (e.g., "current fuel price in Mumbai", "Sensex value today", "weather in Delhi")'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      const result = await webSearchToolImplementation(input);
      return result;
    } catch (error: any) {
      console.error('Web search tool error:', error);
      return `Unable to fetch data: ${error.message}`;
    }
  }
);

const prompt = ai.definePrompt(
  {
    name: 'generateNewspaperLayoutPrompt',
    model: 'googleai/gemini-2.5-pro',
    input: {schema: GenerateNewspaperLayoutInputSchema},
    output: {schema: GenerateNewspaperLayoutOutputSchema},
    tools: [webSearchTool],
    config: {
      temperature: 0.7,
    },
  },
  async (input) => {
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

**🚨 CRITICAL REQUIREMENT - MINIMUM 10-15 PAGES 🚨**
You have ${input.articles.length} articles. You MUST create a MINIMUM of 10-15 pages. DO NOT create just 2-3 pages!

**PAGE CALCULATION:**
- With ${input.articles.length} articles, you should create AT LEAST ${Math.max(10, Math.ceil(input.articles.length / 4))} pages
- Each page should have 3-6 articles maximum (NOT 15-20 articles crammed on 2 pages!)
- Better to have 15 pages with 3 articles each than 3 pages with 15 articles each
- More pages = better readability, no cramming, professional newspaper feel

**ABSOLUTE RULE: ZERO WHITE SPACE TOLERANCE**
Every single pixel of every page must be filled with content. NO exceptions. Each article must be 400-600 words to properly fill space.

**CRITICAL PRINCIPLE: ADAPTIVE, FLUID DESIGN**
You are NOT constrained to fixed categories or page structures. Each edition should be UNIQUE based on available content.
Think like a creative editor who adapts the newspaper design to the day's stories.

**STEP 1: ANALYZE AVAILABLE CONTENT**
First, look at ALL ${input.articles.length} articles and group them by category:
${categoryList}

For each category, count articles:
- **National (Indian news)**: Articles about India, Indian politics, Indian states, domestic affairs
- **International**: Articles about foreign countries, world events, global news
- **Other categories**: Technology, Business, Sports, Culture, Science, Healthcare, Environment

**STEP 2: ADAPTIVE CATEGORY STRATEGY**

**CRITICAL RULES:**
1. **IF a category has 0 articles → SKIP that category entirely (no page for it)**
2. **IF National has 0 Indian articles → Skip National page, start with International or next available**
3. **IF International has 0 world articles → Skip International page**
4. **Only create pages for categories that have articles!**

**SMART CATEGORY DETECTION:**
- **National Page**: ONLY use if you find articles about:
  * India, Indian cities (Mumbai, Delhi, Bangalore, etc.)
  * Indian government, Indian politics, Indian states
  * Domestic Indian affairs, Indian companies, Indian culture
  * Keywords: India, Indian, Delhi, Mumbai, Modi, BJP, Congress, etc.
  
- **International Page**: ONLY use if you find articles about:
  * Foreign countries (USA, China, UK, Russia, etc.)
  * World events, global affairs, international relations
  * Foreign leaders, foreign companies, overseas news
  * Keywords: America, China, Trump, Biden, Europe, UN, NATO, etc.

**FLEXIBLE PAGE STRUCTURE (Adapt based on content):**

- **Page 1**: Front Page - HERO story + 3-4 top stories from ANY available categories

- **Pages 2+**: Create pages ONLY for categories that have articles:
  * IF National has 5+ articles → Create 1-2 National pages
  * IF International has 5+ articles → Create 1-2 International pages
  * IF Business has 4+ articles → Create Business page
  * IF Technology has 4+ articles → Create Technology page
  * IF Sports has 4+ articles → Create Sports page
  * IF Culture has 3+ articles → Create Culture page
  * IF Science/Healthcare/Environment have articles → Create pages as needed

- **Smart Merging (ONLY if category has few articles):**
  * IF National has only 2-3 articles → Merge into Front Page, don't create separate National page
  * IF a category has only 1-2 articles → Place on Front Page or merge with related category
  * Example: 2 Science articles + 2 Healthcare articles = 1 "Science & Health" page

**STEP 3: ELIMINATE WHITE SPACE - MANDATORY LAYOUT RULES**

**ABSOLUTE RULE: ZERO WHITE SPACE TOLERANCE**
Every single pixel of every page must be filled with content. NO exceptions.

**MANDATORY PAGE FILLING STRATEGY:**

1. **Calculate Content Per Page:**
   - Each page MUST have minimum 1400px height worth of content
   - 3-column grid with NO empty columns
   - Minimum 2 full rows (6 content slots)
   - Better: 3 rows (9 content slots) for denser pages

2. **Content Distribution Formula:**
   - **6+ articles:** Use all 6, make articles 350+ words each
   - **5 articles:** 1 article span-2 (500 words) + 4 articles (350 words each)
   - **4 articles:** 2 articles span-2 (600 words each) + 2 articles (400 words) + 2 LARGE info boxes
   - **3 articles:** Each article 600+ words + span-2 class + 3-4 LARGE info boxes between them
   - **2 articles:** Each article 800+ words + span-2 class + multi-column class + 4-5 LARGE info boxes

3. **ARTICLE LENGTH REQUIREMENTS (CRITICAL):**
   - **Single-column article with image:** 350-450 words minimum
   - **Single-column article without image:** 500-650 words minimum  
   - **Span-2 article with image:** 500-700 words minimum
   - **Span-2 article without image:** 700-900 words minimum
   - **Multi-column article:** 600-800 words minimum (text flows across 2 columns)

4. **INFO BOX RULES - CRITICAL FIX:**
   
   **SIZE LIMITATIONS (ABSOLUTE RULES):**
   - Quote boxes: Maximum 4 lines of text, 15-20 words total
   - Stat boxes: One big number + one short label (5 words max)
   - News briefs: 4-5 items, each item one line (10 words max per item)
   - Market data boxes: List format, no long paragraphs
   - Weather boxes: City names + temps, compact table format
   
   **NEVER CREATE LARGE EMPTY BOXES:**
   - No box should exceed 200px height
   - Use padding: 0.8rem (not 1.5rem or 2rem)
   - Use font-size: 0.9rem or 0.95rem (not 1rem or larger)
   - Keep line-height: 1.4 (not 1.8 or 2)
   - Use margin-bottom: 0.5rem between items (not 1rem)
   
   **INFO BOX CONTENT FORMAT - Use inline styles:**
   - div.info-box with style="padding: 0.8rem; font-size: 0.9rem;"
   - h4 with style="margin-bottom: 0.5rem; font-size: 1rem;"
   - Each p with style="margin: 0.3rem 0;"
   - Include 3-5 data points per box (like Sensex, Nifty, Bank Nifty)
   - Keep content concise and data-focused
   
   **STRATEGIC BOX PLACEMENT:**
   - Only add boxes in the THIRD column (right side)
   - First two columns: ONLY articles (no boxes interrupting)
   - Third column: Mix of 1-2 articles + 2-3 compact boxes
   - Boxes go at BOTTOM of column, never at top
   - Good: Article, Article, Article-then-Box
   - Bad: Article, Box, Article (disrupts reading flow)

5. **LAYOUT PATTERNS (STRICT TEMPLATES):**

   **Pattern A - 6 Articles (Standard):**
   Row 1: [Article 350w] [Article 350w] [Article 350w]
   Row 2: [Article 350w] [Article 350w] [Article 350w + Compact-Box]

   **Pattern B - 5 Articles (Feature):**
   Row 1: [BIG Article 600w span-2        ] [Article 400w]
   Row 2: [Article 400w] [Article 400w] [Article 400w + Box]

   **Pattern C - 4 Articles (Expanded):**
   Row 1: [BIG Article 700w span-2        ] [Article 500w + Box]
   Row 2: [Article 600w] [BIG Article 700w span-2        ]

   **Pattern D - 3 Articles (Maximum Fill):**
   Row 1: [HUGE Article 800w span-2 multi-column] [Article 600w + Box]
   Row 2: [Article 700w] [HUGE Article 800w span-2 multi-column]

6. **MANDATORY TECHNIQUES TO FILL SPACE:**
   - ✅ Increase article word count (primary method)
   - ✅ Use span-2 class on 1-2 articles per page
   - ✅ Use multi-column class on long articles (text flows in 2 columns)
   - ✅ Add 2-3 compact info boxes in right column
   - ✅ Increase image sizes (hero-image or story-image-large)
   - ✅ Add more paragraphs with quotes, statistics, context
   - ✅ Use CSS: min-height: 1400px on every .newspaper-page
   - ❌ NEVER leave empty space at bottom
   - ❌ NEVER create half-filled columns
   - ❌ NEVER create large empty boxes

**STEP 4: ENSURE NO WHITE SPACE**

**For each page, calculate:**
- Articles available in this category
- Target: Fill 2 rows × 3 columns (6 slots)

**If you have:**
- **6+ articles**: Use 6 articles in standard 2-row grid
- **5 articles**: Use Pattern B (1 span-2 feature + 4 normal)
- **4 articles**: Use Pattern D (1 span-2 + 3 normal + boxes)
- **3 articles**: Make 1 span-2, add boxes, expand content
- **2 articles**: Each spans-2, add data boxes between
- **1 article**: Skip category or merge into another page

**NO FIXED STRUCTURE - BE ADAPTIVE!**
Don't force categories. If this edition has mostly Tech and Sports, make those pages great!
If there's no Indian news, skip National page entirely.
Every edition should feel fresh and different based on the day's news.

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

6. **DATA BOXES & WIDGETS - REVOLUTIONARY 40-50 BOX SYSTEM:**

   **🚨 CRITICAL: CREATE 40-50 COMPACT BOXES TO ELIMINATE WHITE SPACE 🚨**
   
   **BOX PHILOSOPHY:**
   - Small boxes stacked vertically = NO white space
   - Colored boxes matching page theme = Professional look
   - 40-50 boxes total across all pages = Information-rich newspaper
   - Smart placement based on article count per category
   
   **BOX SIZING RULES (ABSOLUTE):**
   - Height: 80-150px maximum (NEVER 300-400px!)
   - Padding: 0.8rem (NOT 2rem)
   - Font-size: 0.9rem (NOT 1.1rem)
   - Line-height: 1.3 (NOT 1.8)
   - Margins: 0.5rem between boxes
   - Each box: 3-5 lines of content maximum
   
   **BOX COLORS BY PAGE:**
   - Business page boxes: background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;
   - Sports page boxes: background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white;
   - Technology page boxes: background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;
   - Culture page boxes: background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white;
   - National page boxes: background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;
   - Science page boxes: background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white;
   - Health page boxes: background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white;
   
   **BOX PLACEMENT STRATEGY - INTELLIGENT DISTRIBUTION:**
   
   **IF page has 6+ articles → Add 2-3 compact boxes**
   **IF page has 4-5 articles → Add 4-6 compact boxes**
   **IF page has 2-3 articles → Add 8-10 compact boxes**
   **IF page has 1 article → Add 12-15 compact boxes**
   
   Stack boxes vertically in the 3rd column (right side). Never interrupt articles.
   
   **STEP 1: GATHER DATA (Make 15-20 webSearch calls):**
   
   Use webSearch tool to collect ALL this data:
   
   **BUSINESS/FINANCE DATA:**
   1. webSearch("current Sensex Nifty 50 Bank Nifty closing price today India NSE BSE")
   2. webSearch("top gainers NSE today India stock market")
   3. webSearch("top losers NSE today India stock market")
   4. webSearch("current petrol diesel prices Mumbai Delhi Bangalore Chennai Kolkata today")
   5. webSearch("current gold 22k 24k silver price India today per 10 grams")
   6. webSearch("current Bitcoin Ethereum Ripple price INR today cryptocurrency")
   7. webSearch("current USD EUR GBP to INR exchange rate today")
   8. webSearch("top 5 richest people in the world current net worth 2025")
   9. webSearch("IPO upcoming this week India latest listings subscription status")
   
   **WEATHER DATA:**
   10. webSearch("current weather temperature Mumbai Delhi Bangalore Chennai Kolkata Hyderabad Pune today")
   
   **CULTURE/ENTERTAINMENT DATA:**
   11. webSearch("new movies releasing this week India Bollywood Hollywood OTT Netflix Prime Disney")
   12. webSearch("new web series releasing this week Netflix Prime Disney Hotstar")
   13. webSearch("top songs trending India Spotify today music chart")
   14. webSearch("new books releasing this week bestsellers India 2025")
   
   **SCIENCE/TECH DATA:**
   15. webSearch("latest technology news today India startups funding AI gadgets")
   16. webSearch("interesting science facts discoveries breakthrough today")
   
   **HEALTH DATA:**
   17. webSearch("daily health tips wellness advice nutrition facts")
   
   **OTHER DATA:**
   18. webSearch("sunrise sunset time Mumbai Delhi Bangalore Chennai Kolkata today")
   19. webSearch("word of the day English vocabulary interesting words")
   20. webSearch("famous quote of the day inspirational motivational")
   
   **STEP 2: CREATE 40-50 COMPACT BOXES**
   
   **BUSINESS PAGE (8-12 boxes):**
   - Market Watch (Sensex, Nifty, Bank Nifty with change %)
   - Top 5 Gainers (stock names + % change)
   - Top 5 Losers (stock names + % change)
   - Fuel Prices (Petrol/Diesel in 5 cities)
   - Gold & Silver Prices (22K, 24K, Silver rates)
   - Crypto Corner (Bitcoin, Ethereum, Ripple prices)
   - Currency Rates (USD, EUR, GBP to INR)
   - World's Richest (Top 5 with net worth)
   - IPO Watch (Upcoming IPOs this week)
   - Economic Indicator (GDP, Inflation, etc.)
   - Stock Tip of the Day
   - Market Trivia
   
   **SPORTS PAGE (6-10 boxes):**
   IMPORTANT: Sports boxes are PRE-GENERATED by Sports Journalist and provided in sportsBoxes parameter.
   DO NOT use webSearch for sports data. Simply format and display the provided sports boxes on the Sports page.
   The sportsBoxes array contains ready-to-use data with sport name, title, content, and type.
   Just create HTML boxes from this pre-generated data with orange gradient styling.
   
   **TECHNOLOGY PAGE (5-8 boxes):**
   - Tech News Briefs (4-5 one-line items)
   - Startup Funding (recent funding rounds)
   - Tech Tip of the Day
   - Gadget Launch (new devices)
   - AI Update (latest AI developments)
   - Tech Trivia
   - App of the Week
   
   **CULTURE PAGE (6-10 boxes):**
   - This Week's Movies (Bollywood + Hollywood)
   - OTT Releases (Netflix, Prime, Disney+)
   - Editor's Pick: Movie of the Week
   - Editor's Pick: Series of the Week
   - Music Chart (Top 5 songs)
   - Books to Read (new releases)
   - Weekend Guide (what to watch/read)
   - Celebrity News Brief
   - Movie Trivia
   
   **SCIENCE PAGE (4-6 boxes):**
   - Science Fact of the Day
   - Did You Know? (interesting fact)
   - Space Update (NASA, ISRO news)
   - Tech Innovation (new patents/inventions)
   - Science Quiz
   - Research Highlight
   
   **HEALTH PAGE (4-6 boxes):**
   - Health Tip of the Day
   - Nutrition Fact
   - Wellness Advice
   - Exercise Tip
   - Mental Health Tip
   - Health Quiz
   
   **NATIONAL PAGE (5-8 boxes):**
   - Weather Today (5-6 major cities)
   - Sunrise/Sunset Times
   - This Day in History
   - Quote of the Day
   - Word of the Day
   - Poll Result
   - Reader's Corner
   - National Trivia
   
   **BOX CONTENT EXAMPLE:**
   
   Market Watch box with green gradient background (#10b981 to #059669), white color, 0.8rem padding, 0.9rem font-size, line-height 1.3, margin-bottom 0.8rem, border-radius 8px. Contains title "Market Watch" at 1rem font-size, bold, then 3-5 data points at 0.85rem: Sensex 82,347 up 1.2%, Nifty 50 25,184 up 0.8%, Bank Nifty 54,230 up 0.5%.
   
   **CRITICAL RULES:**
   - Use inline styles for EVERY box (padding, font-size, colors, margins)
   - Match gradient color to page category
   - Maximum 5 lines of content per box
   - Stack boxes vertically in right column
   - Leave 0.8rem margin between boxes
   - NO large empty boxes - every box must have 3-5 data points

7. **FRONT PAGE COVER IMAGE & TITLE - CRITICAL FIX:**
   
   **THE ISSUE:** Edition title and cover image are generic/not found in newspaper
   
   **THE FIX:**
   - Edition title MUST be the first article's headline (the hero story)
   - Cover image MUST be the first article's image
   - NO generic titles like "Breaking News" or "The Daily Agent"
   - The front page hero story should be the most important story of the day
   
   **IMPLEMENTATION:**
   - Take Article 1 (first article provided) → This is your hero story
   - Use Article 1's headline as the edition title
   - Use Article 1's imageUrl as the cover image
   - Place this article prominently on Page 1 with hero-story class
   
   Example:
   If Article 1 is "Sabrina Carpenter's Dazzling Rhinestone Bodysuit..."
   Then edition title = "Sabrina Carpenter's Dazzling Rhinestone Bodysuit..."
   And cover photo = Article 1's imageUrl

8. **COMPREHENSIVE COMPONENTS FOR EACH PAGE TYPE:**

   **SPORTS PAGE COMPONENTS (MANDATORY):**
   - **Cricket:** Live scores, IPL standings, Test match updates, ODI results
   - **Football:** Premier League results, La Liga scores, Champions League, Indian Super League
   - **F1 Racing:** If F1 weekend, include race results, driver standings, constructor points
   - **Tennis:** Grand Slam updates, ATP/WTA rankings, tournament results
   - **Other Sports:** Badminton rankings, Hockey scores, Athletics records, Chess updates
   - **Scoreboard Widget:** Today's matches with live scores or final results
   - Example: Use webSearch("latest cricket football F1 tennis scores today India")
   
   **SCIENCE/TECHNOLOGY PAGE COMPONENTS (MANDATORY):**
   - **Science Facts:** Recent discoveries, research breakthroughs, space missions
   - **Tech News Snippets:** Startup funding news, gadget launches, AI developments
   - **Did You Know?** Scientific trivia, interesting facts about nature/physics/biology
   - **Innovation Corner:** New patents, inventions, technological breakthroughs
   - **Tech Tips:** Quick productivity hacks, software tips, security advice
   - Example: Use webSearch("latest technology news India startups science discoveries today")
   
   **CULTURE/ENTERTAINMENT PAGE COMPONENTS (MANDATORY):**
   - **New Movie Releases:** Bollywood and Hollywood films releasing this week
   - **OTT Premieres:** Netflix, Prime Video, Disney+, Hotstar new series/movies
   - **Music Chart:** Top songs, trending music, new album releases
   - **Book Releases:** New books by popular authors, bestseller lists
   - **Celebrity News:** Award shows, celebrity events, entertainment gossip
   - **Weekend Guide:** What to watch, what to read, where to go
   - Example: Use webSearch("new movies releasing India this week OTT Netflix Prime")
   
   **BUSINESS PAGE COMPONENTS (MANDATORY):**
   - **Market Data:** Sensex, Nifty 50, top gainers, top losers
   - **Fuel Prices:** Petrol/diesel prices in major cities
   - **Gold/Silver Prices:** 22K, 24K gold rates per 10 grams
   - **Cryptocurrency:** Bitcoin, Ethereum prices in INR
   - **Currency Rates:** USD, EUR, GBP to INR exchange rates
   - **IPO Updates:** Upcoming IPOs, recent listings, subscription status
   - Example: Use webSearch("current Sensex Nifty gold Bitcoin fuel prices today India")
   
   **NATIONAL/FRONT PAGE COMPONENTS (OPTIONAL):**
   - **Weather Forecast:** Temperature and conditions for major cities
   - **Quote of the Day:** Inspirational or thought-provoking quote
   - **This Day in History:** Important events that happened on this date
   - **Sunrise/Sunset Times:** For major Indian cities
   - Example: Use webSearch("current weather Mumbai Delhi Bangalore Chennai today")
   
   **UNIVERSAL COMPONENTS (USE ACROSS ANY PAGE):**
   - **Word of the Day:** Interesting vocabulary with definition
   - **Health Tip:** Quick wellness advice, nutrition facts
   - **Trivia Box:** Interesting facts related to page category
   - **Poll Results:** Public opinion on current issues
   - **Reader's Corner:** Letters to editor, reader submissions

9. **ARTICLE EXPANSION STRATEGIES (CRITICAL FOR LENGTH):**

   **Automatic Article Enlargement:**
   - **300 words minimum:** Every article should have substantial content
   - **400-500 words for major stories:** Top stories need comprehensive coverage
   - **Text-only articles:** Should be LONGER (400-600 words) to compensate for no image
   - **Combined with 40-50 boxes:** Articles + boxes = ZERO white space
   - **Add these elements to expand articles:**
     * More paragraphs with detailed context and background
     * Expert quotes from officials, analysts, witnesses
     * Statistical data and numbers to support story
     * Historical context ("This is not the first time...")
     * Future implications ("This could lead to...")
     * Multiple perspectives (government view, opposition view, public reaction)
     * Regional impact (how it affects different states/cities)
   
   **Text-Only vs Image Articles:**
   - **Articles WITH images:** 300-400 words (image provides visual interest)
   - **Articles WITHOUT images:** 450-600 words (text must compensate)
   - **Strategy:** Make text-only articles more detailed, analytical, in-depth
   - **Visual balance:** Cluster 2-3 text-only articles together for cleaner layout
   
   **Content Enrichment Techniques:**
   - **For Political stories:** Add party reactions, voter sentiment, election impact
   - **For Economic stories:** Add market analysis, expert predictions, global comparison
   - **For Sports stories:** Add player statistics, team rankings, match analysis
   - **For Tech stories:** Add company background, competitor analysis, market potential
   - **For Culture stories:** Add reviews, ratings, box office predictions, audience reactions
   
   **Multi-Page Category Expansion:**
   - **IF National has 6+ articles:** Create "National News Part I" (Page 2) and "National News Part II" (Page 3)
   - **IF Business has 6+ articles:** Create "Business & Markets" (Page 5) and "Business & Economy" (Page 6)
   - **IF Sports has 7+ articles:** Create "Sports - Cricket" (Page 8) and "Sports - Football & More" (Page 9)
   - **TARGET:** 10-15 pages minimum (not just 5-7 pages)
   - **STRATEGY:** Better to have more pages with comfortable spacing than cramming everything

10. **Modern Aesthetic:**
   - Consistent spacing and rhythm
   - Balanced visual weight across columns
   - Clean typography with proper hierarchy
   - Professional color palette throughout
   - Equal page lengths with proper page breaks (min-height: 1400px)
   - Pages feel full and information-rich, never sparse
   - Text-only articles clustered together for visual coherence

**PROVIDED ARTICLES (${input.articles.length} total):**
${articlesText}

**Categories Present:** ${categoryList}

**PRE-GENERATED SPORTS DATA:**
${input.sportsBoxes && input.sportsBoxes.length > 0 
  ? `✅ Sports Journalist provided ${input.sportsBoxes.length} ready-to-use sports boxes.
DO NOT use webSearch for sports - all data is pre-generated below:

${input.sportsBoxes.map((box, idx) => `Box ${idx + 1} [${box.sport}]: ${box.title}\n${box.content}`).join('\n\n')}

For Sports page: Format these boxes with orange gradient. DO NOT search again.`
  : '❌ No sports data available. Skip sports page.'
}

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
            <div class="nameplate" style="background: linear-gradient(135deg, #d32f2f 0%, #000000 50%, #d32f2f 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); font-weight: 900; letter-spacing: 0.3rem;">THE DAILY AGENT</div>
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
                <a href="#international">International</a>
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
            
            <!-- SUPPLEMENTARY WIDGET TEMPLATES - Use webSearch tool for real-time data! -->
            <!-- YOU HAVE A webSearch TOOL - use it to fetch current fuel prices, market data, weather, etc. -->
            <!-- Call webSearch("current fuel prices Mumbai Delhi today") to get REAL prices -->
            
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
            <!-- IMPORTANT: Call webSearch tool to fetch REAL current data for ${currentDate}! -->
            <!-- Example: webSearch("current Sensex Nifty today") for market data -->
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
    console.log(`📰 Editor 1: Starting layout generation with ${input.articles.length} articles...`);
    console.log(`📰 Editor 1: Article categories:`, [...new Set(input.articles.map(a => a.category))].join(', '));
    
    try {
      console.log(`🤖 Editor 1: Calling Gemini 2.5 Pro with tools...`);
      const startTime = Date.now();
      
      const result = await prompt(input);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`⏱️ Editor 1: Gemini call completed in ${elapsedTime}ms`);
      
      if (!result.output) {
        console.error(`❌ Editor 1: Gemini returned null/undefined output`);
        console.error(`❌ Editor 1: Full result:`, JSON.stringify(result, null, 2));
        throw new Error('Gemini returned null output - possible token limit or rate limit');
      }
      
      if (!result.output.html) {
        console.error(`❌ Editor 1: Output exists but html field is missing`);
        console.error(`❌ Editor 1: Output keys:`, Object.keys(result.output));
        throw new Error('Gemini output missing html field');
      }
      
      console.log(`✅ Editor 1: Generated HTML (${result.output.html.length} characters)`);
      console.log(`✅ Editor 1: HTML preview:`, result.output.html.substring(0, 200) + '...');
      
      return result.output;
    } catch (error: any) {
      console.error(`❌ Editor 1: Error during generation:`, error.message);
      console.error(`❌ Editor 1: Error stack:`, error.stack);
      console.error(`❌ Editor 1: Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }
);
