# Google Search Grounding - Important Information

## Current Status

**Google Search grounding is NOT available with the Google AI plugin we're using.**

## Technical Details

### What We're Using
- **Plugin:** `@genkit-ai/google-genai` (Google AI / Gemini API)
- **Model:** `gemini-2.5-pro`
- **Authentication:** API Key via `GEMINI_API_KEY`

### Google Search Availability
According to [official Gemini API documentation](https://ai.google.dev/gemini-api/docs/grounding):
- ✅ **Supported:** Vertex AI plugin with `google_search` tool
- ❌ **NOT Supported:** Google AI plugin (what we're using)

### Why This Limitation Exists
The Google AI plugin is the simpler API-key-based service intended for:
- Development and prototyping
- Smaller-scale applications
- Direct API key authentication

The Vertex AI plugin provides enterprise features including:
- Google Search grounding
- Context caching
- Vector Search
- Model Garden access
- Requires: Google Cloud Project + Service Account

## Our Solution

Instead of real-time Google Search, we've configured the layout generator to:

### 1. Use Training Knowledge
Gemini 2.5 Pro has training data up to early 2024 and can generate plausible content based on:
- Historical patterns
- Seasonal trends
- Typical value ranges
- General knowledge

### 2. Provide Guidance for Plausible Values

**Fuel Prices (Typical Ranges):**
```
Mumbai:    ₹105-107/L (Petrol), ₹93-95/L (Diesel)
Delhi:     ₹95-98/L (Petrol), ₹88-90/L (Diesel)
Bangalore: ₹101-103/L (Petrol), ₹86-88/L (Diesel)
Chennai:   ₹102-104/L (Petrol), ₹93-95/L (Diesel)
Kolkata:   ₹104-106/L (Petrol), ₹91-93/L (Diesel)
```

**Market Data (Trending Patterns):**
```
Sensex:    ~82,000-83,000
Nifty 50:  ~25,000-25,200
Gold:      ₹72,000-73,000 per 10g
Bitcoin:   ₹45-48 lakh
Ethereum:  ₹1.9-2.1 lakh
```

**Weather (Seasonal Patterns):**
```
Winter (Nov-Feb): 18-28°C
Summer (Mar-Jun): 32-42°C
Monsoon (Jul-Sep): 24-30°C
```

### 3. Focus on Design Quality
The goal is to demonstrate:
- Professional newspaper layout
- Comprehensive daily content
- Visual excellence and balance
- Proper widget integration

**Not** to provide real-time stock prices or fuel rates.

## If You Need Real-Time Data

### Option 1: Switch to Vertex AI Plugin

**Pros:**
- Native Google Search grounding support
- Enterprise-grade features
- Official Google integration

**Cons:**
- Requires Google Cloud Project setup
- Service account authentication
- More complex configuration
- Potentially higher costs

**Implementation:**
```bash
npm install @genkit-ai/vertexai
```

```typescript
import { vertexAI } from '@genkit-ai/vertexai';

const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'your-project-id',
      location: 'us-central1',
    }),
  ],
  model: 'googleai/gemini-2.5-pro',
});

// Then add google_search tool in config
const response = await ai.generate({
  model: 'googleai/gemini-2.5-pro',
  prompt: 'What is the current fuel price in Mumbai?',
  config: {
    tools: [{ googleSearch: {} }],
  },
});
```

### Option 2: Create Custom Search Tool

Add a custom tool that makes actual API calls to:
- Google Custom Search API
- SerpAPI
- Bing Search API
- Financial data APIs (Alpha Vantage, Yahoo Finance)

**Example:**
```typescript
const searchTool = ai.defineTool(
  {
    name: 'webSearch',
    description: 'Search the web for current information',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    // Make actual API call to search service
    const response = await fetch(`https://api.search-service.com?q=${input.query}`);
    return response.text();
  }
);

// Use in generate
const response = await ai.generate({
  prompt: 'What is the current fuel price in Mumbai?',
  tools: [searchTool],
});
```

### Option 3: Pre-fetch Data

Fetch real-time data separately and inject it into the prompt:

```typescript
// Fetch real data before generation
const fuelPrices = await fetchFuelPrices();
const marketData = await fetchMarketData();

const response = await ai.generate({
  prompt: `Generate newspaper with this current data:
    Fuel Prices: ${JSON.stringify(fuelPrices)}
    Market Data: ${JSON.stringify(marketData)}
    ...`,
});
```

## Current Implementation Impact

### What Works Well:
✅ Professional newspaper layout and design
✅ Category-based page organization
✅ Comprehensive supplementary widgets
✅ Plausible daily content
✅ Visual balance and white space elimination

### What's Estimated:
⚠️ Fuel prices (within typical ranges)
⚠️ Stock market values (trending patterns)
⚠️ Weather data (seasonal averages)
⚠️ Entertainment releases (general knowledge)
⚠️ Sports scores (realistic formats)

### For Production Use:
If your newspaper requires **accurate real-time data**, consider:
1. Switching to Vertex AI plugin (for native Google Search)
2. Implementing custom search tools (for specific data sources)
3. Pre-fetching data from APIs (for critical information)

## References

- [Gemini API Google Search Documentation](https://ai.google.dev/gemini-api/docs/grounding)
- [Genkit Google AI Plugin](https://genkit.dev/docs/integrations/google-genai/)
- [Genkit Vertex AI Plugin](https://genkit.dev/docs/integrations/vertex-ai/)
- [Genkit Tool Calling](https://genkit.dev/docs/tool-calling/)

---

**Last Updated:** November 26, 2025
**Current Setup:** Google AI Plugin (API Key) - No Real-Time Search
**Recommendation:** Use plausible data for demo/development, implement real search for production
