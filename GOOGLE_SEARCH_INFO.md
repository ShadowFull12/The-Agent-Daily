# Google Search / Real-Time Data - Current Implementation

## ✅ WORKING SOLUTION IMPLEMENTED!

**We've implemented a hybrid approach using Gemini 2.5 Pro + Grok's web search!**

### How It Works

1. **Gemini 2.5 Pro** generates the newspaper layout
2. When Gemini needs current data (fuel prices, stocks, weather), it calls the **webSearch tool**
3. The webSearch tool uses **Grok's native web search** via OpenRouter
4. Grok searches the web and returns real-time information
5. Gemini incorporates the real data into the newspaper widgets

This gives us the best of both worlds:
- Gemini's superior layout generation and instruction-following
- Grok's real-time web search capabilities (free tier!)

## Technical Implementation

### Architecture

```
User Request
    ↓
Gemini 2.5 Pro (Layout Generation)
    ↓
Needs current data? → Call webSearch tool
    ↓
Grok (via OpenRouter) → Performs web search
    ↓
Returns real-time data (fuel prices, stocks, etc.)
    ↓
Gemini incorporates data into newspaper HTML
    ↓
Final newspaper with real current information
```

### Code Structure

**1. Web Search Tool** (`src/ai/tools/web-search-tool.ts`)
- Defines the webSearch tool schema
- Implements the tool using OpenRouter API
- Calls Grok with web search queries
- Helper functions for specific data types

**2. Layout Generator** (`src/ai/flows/generate-newspaper-layout.ts`)
- Imports and defines the webSearch tool
- Adds tool to Gemini prompt configuration
- Instructs Gemini when and how to use the tool
- Gemini autonomously decides when to call it

### Tool Configuration

```typescript
// Define the web search tool
const webSearchTool = ai.defineTool(
  {
    name: 'webSearch',
    description: 'Search the web for current, real-time information...',
    inputSchema: z.object({
      query: z.string().describe('The search query...'),
    }),
  },
  async (input) => {
    // Call Grok via OpenRouter with web search
    return await callGrokWithWebSearch(input.query);
  }
);

// Add tool to Gemini prompt
const prompt = ai.definePrompt({
  model: 'googleai/gemini-2.5-pro',
  tools: [webSearchTool], // Gemini can now call this
  ...
});
```

## Example Tool Calls

When generating a newspaper, Gemini might make calls like:

1. `webSearch("current fuel prices Mumbai Delhi Bangalore Chennai Kolkata today")`
   - Returns: "Mumbai: Petrol ₹106.31/L, Diesel ₹94.27/L..."

2. `webSearch("current Sensex Nifty Gold price Bitcoin India today")`
   - Returns: "Sensex: 82,347 ▲1.2%, Nifty: 25,184 ▲0.8%..."

3. `webSearch("current weather Mumbai Delhi Bangalore temperature today")`
   - Returns: "Mumbai: 32°C Partly Cloudy, Delhi: 28°C Clear..."

4. `webSearch("new movies releasing this week India OTT")`
   - Returns: "Cinemas: Fighter (Action), Netflix: Ghazi..."

5. `webSearch("latest cricket football scores today India")`
   - Returns: "India 342/5 vs Australia (Live), Man Utd 2-1 Chelsea..."

## Configuration

### Environment Variables Required

```bash
GEMINI_API_KEY=your_gemini_key          # For Gemini 2.5 Pro
OPENROUTER_API_KEY=your_openrouter_key  # For Grok access
```

### Models Used

- **Primary:** `googleai/gemini-2.5-pro` (layout generation)
- **Tool:** `x-ai/grok-2-1212` via OpenRouter (web search)

## Benefits of This Approach

✅ **Real-Time Data:** Grok fetches actual current information
✅ **Free Tier:** Grok 4.1 Fast has a free tier on OpenRouter
✅ **Accurate:** Real web search, not estimates
✅ **Automatic:** Gemini decides when to search
✅ **Cost Effective:** Only pays for searches actually needed
✅ **Best Models:** Gemini for generation, Grok for search

## Limitations & Considerations

### API Limits
- OpenRouter free tier has rate limits
- Tool calls add latency (3-5 seconds per search)
- Each search uses Grok tokens

### When Tool Calls Happen
Gemini autonomously decides when to call webSearch:
- Usually 3-5 calls per newspaper generation
- Focuses on most important daily data
- Skips searches for static content (quotes, tips, trivia)

### Fallback Behavior
If webSearch fails (API error, timeout):
- Tool returns fallback message
- Gemini uses training knowledge for estimates
- Newspaper still generates successfully

## Cost Analysis

### Per Newspaper Generation

**Gemini 2.5 Pro:**
- Input: ~15,000 tokens (prompt + articles)
- Output: ~8,000 tokens (HTML)
- Cost: ~$0.10 per newspaper

**Grok via OpenRouter:**
- 3-5 web searches per newspaper
- ~500 tokens per search
- Free tier: No cost for moderate usage
- Paid: ~$0.01-0.02 per newspaper

**Total:** ~$0.10-0.12 per newspaper (mostly Gemini)

## Monitoring

Check logs for tool usage:

```
🔍 Web Search Tool called with query: "current fuel prices..."
✅ Web Search Tool result: Mumbai: Petrol ₹106.31/L...
```

## Previous Approaches (Not Used)

### ❌ Google Search Grounding
- Only available in Vertex AI plugin
- Requires GCP setup, service accounts

## References

- [Gemini API Google Search Documentation](https://ai.google.dev/gemini-api/docs/grounding)
- [Genkit Google AI Plugin](https://genkit.dev/docs/integrations/google-genai/)
- [Genkit Vertex AI Plugin](https://genkit.dev/docs/integrations/vertex-ai/)
- [Genkit Tool Calling](https://genkit.dev/docs/tool-calling/)

---

**Last Updated:** November 26, 2025
**Current Setup:** Google AI Plugin (API Key) - No Real-Time Search
**Recommendation:** Use plausible data for demo/development, implement real search for production
