'use server';

/**
 * @fileOverview Sports Journalist - Generates comprehensive sports data boxes
 * Searches for previous day's sports results and creates compact data boxes
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { webSearchToolImplementation } from '@/ai/tools/web-search-tool';

const GenerateSportsBoxesInputSchema = z.object({
  date: z.string().describe('The date for which to find sports results'),
});

export type GenerateSportsBoxesInput = z.infer<typeof GenerateSportsBoxesInputSchema>;

const GenerateSportsBoxesOutputSchema = z.object({
  boxes: z.array(z.object({
    sport: z.string().describe('Sport name (Football, Cricket, Basketball, F1, etc.)'),
    title: z.string().describe('Box title'),
    content: z.string().describe('Compact data content'),
    type: z.string().describe('Box type: scores, standings, schedule'),
  })).describe('Array of sports data boxes'),
});

export type GenerateSportsBoxesOutput = z.infer<typeof GenerateSportsBoxesOutputSchema>;

export async function generateSportsBoxes(input: GenerateSportsBoxesInput): Promise<GenerateSportsBoxesOutput> {
  return generateSportsBoxesFlow(input);
}

// Define and export the web search tool for sports data
export const sportsWebSearchTool = ai.defineTool(
  {
    name: 'webSearch',
    description: 'Search for sports scores, results, standings, and schedules',
    inputSchema: z.object({
      query: z.string().describe('Sports search query'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      const result = await webSearchToolImplementation(input);
      return result;
    } catch (error: any) {
      console.error('Sports web search error:', error);
      return `Unable to fetch data: ${error.message}`;
    }
  }
);

const prompt = ai.definePrompt(
  {
    name: 'generateSportsBoxesPrompt',
    model: 'googleai/gemini-2.5-pro',
    input: {schema: GenerateSportsBoxesInputSchema},
    output: {schema: GenerateSportsBoxesOutputSchema},
    tools: [sportsWebSearchTool],
    config: {
      temperature: 0.7,
    },
  },
  async (input) => {
    return {
      messages: [{
        role: 'user',
        content: [{
          text: `You are a SPORTS JOURNALIST for "The Daily Agent" newspaper. Your job is to gather yesterday's/recent sports results and create COMPACT data boxes.

**DATE:** ${input.date}

**YOUR MISSION:**
Use the webSearch tool extensively to find recent sports results. Create 15-25 compact data boxes with scores, standings, and schedules.

**STEP 1: SEARCH FOR SPORTS DATA (Make 10-15 webSearch calls)**

Use webSearch to find data for ALL these sports:

1. **Football (Soccer):**
   - webSearch("Premier League results scores yesterday latest matchday")
   - webSearch("La Liga results scores yesterday latest matchday")
   - webSearch("Bundesliga results scores yesterday latest")
   - webSearch("UEFA Champions League latest results this week")
   - webSearch("UEFA Europa League latest results this week")
   - webSearch("Indian Super League ISL results yesterday latest")

2. **Cricket:**
   - webSearch("cricket live scores latest matches India today yesterday")
   - webSearch("IPL latest scores results today yesterday")
   - webSearch("Test cricket live scores latest matches")
   - webSearch("T20 cricket latest scores international matches")

3. **Basketball:**
   - webSearch("NBA scores results yesterday latest games")
   - webSearch("NBA Eastern Western Conference standings top 5")

4. **Formula 1:**
   - webSearch("F1 Formula 1 latest race results this weekend")
   - webSearch("F1 driver standings championship top 5 current")
   - webSearch("F1 constructor standings top 5 current")
   - webSearch("F1 next race schedule qualifying sprint")

5. **Tennis:**
   - webSearch("tennis ATP WTA latest tournament results today")
   - webSearch("ATP rankings top 5 current")
   - webSearch("WTA rankings top 5 current")

6. **Other Sports:**
   - webSearch("badminton latest results India today")
   - webSearch("hockey India latest scores results")
   - webSearch("kabaddi Pro Kabaddi League latest scores")

**STEP 2: CREATE COMPACT DATA BOXES**

For each sport with available data, create 1-3 boxes. Each box should be VERY COMPACT:

**Example Boxes:**

\`\`\`json
{
  "sport": "Football",
  "title": "Premier League - Matchday 13",
  "content": "Man City 3-1 Liverpool\\nArsenal 2-0 Chelsea\\nMan Utd 1-1 Tottenham\\nNewcastle 4-1 Brighton",
  "type": "scores"
}
\`\`\`

\`\`\`json
{
  "sport": "Cricket",
  "title": "IND vs AUS - 2nd Test, Day 3",
  "content": "India: 487/10 & 178/4\\nAustralia: 352/10\\nIndia lead by 313 runs\\nVirat Kohli 89*, Rohit Sharma 45",
  "type": "scores"
}
\`\`\`

\`\`\`json
{
  "sport": "F1",
  "title": "Drivers' Championship Top 5",
  "content": "1. Max Verstappen - 489 pts\\n2. Sergio Perez - 223 pts\\n3. Lewis Hamilton - 208 pts\\n4. Fernando Alonso - 192 pts\\n5. Carlos Sainz - 177 pts",
  "type": "standings"
}
\`\`\`

\`\`\`json
{
  "sport": "Basketball",
  "title": "NBA Last Night",
  "content": "Lakers 118-110 Celtics\\nWarriors 132-126 Suns\\nBucks 128-119 Heat\\n76ers 105-103 Nets",
  "type": "scores"
}
\`\`\`

**BOX CONTENT RULES:**
- Maximum 4-5 lines per box
- Use \\n for line breaks
- Show team/player names with scores
- Keep it data-focused, no long explanations
- If no data available for a sport, skip it

**TARGET: 15-25 boxes total** covering as many sports as possible

Generate boxes now based on webSearch results!`
        }]
      }]
    };
  }
);

const generateSportsBoxesFlow = ai.defineFlow(
  {
    name: 'generateSportsBoxesFlow',
    inputSchema: GenerateSportsBoxesInputSchema,
    outputSchema: GenerateSportsBoxesOutputSchema,
  },
  async (input) => {
    console.log(`⚽ Sports Journalist: Gathering sports data for ${input.date}...`);
    
    try {
      const result = await prompt(input);
      
      if (!result.output) {
        console.error(`❌ Sports Journalist: No output returned`);
        throw new Error('Sports Journalist returned null output');
      }
      
      console.log(`✅ Sports Journalist: Generated ${result.output.boxes.length} sports boxes`);
      return result.output;
    } catch (error: any) {
      console.error(`❌ Sports Journalist: Error - ${error.message}`);
      throw error;
    }
  }
);
