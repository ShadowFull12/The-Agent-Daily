'use server';

/**
 * Web Search Tool using Tavily API for REAL-TIME web search
 * Tavily is a FREE search API optimized for AI applications
 * Provides current, factual information from the web
 */

import { z } from 'genkit';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer: string;
  results: TavilySearchResult[];
}

/**
 * Call Tavily API for real-time web search
 * FREE tier: ~1000 searches/month
 */
async function callTavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not found in environment variables');
  }

  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} ${today}`,
        search_depth: 'basic', // 'basic' or 'advanced'
        include_answer: true, // Get AI-generated answer
        include_raw_content: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Tavily API error: ${response.status} - ${error}`);
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data: TavilyResponse = await response.json();
    
    // Return the AI-generated answer if available, otherwise compile from results
    if (data.answer) {
      return `${data.answer}\n\nDate: ${today}`;
    }
    
    // Fallback: compile information from search results
    const compiledInfo = data.results
      .slice(0, 3)
      .map((result, index) => `${index + 1}. ${result.content}`)
      .join('\n\n');
    
    return `${compiledInfo}\n\nDate: ${today}`;
  } catch (error) {
    console.error('Error calling Tavily search:', error);
    throw error;
  }
}

/**
 * Get web search tool schema - export as function
 */
export async function getWebSearchToolSchema() {
  return {
    name: 'webSearch',
    description: 'Search the web for current, real-time information including stock prices, fuel prices, weather, news, entertainment releases, and sports scores. Use this when you need up-to-date factual information that may have changed recently.',
    inputSchema: z.object({
      query: z.string().describe('The search query. Be specific about what information you need (e.g., "current fuel price in Mumbai", "Sensex value today", "weather in Delhi")'),
    }),
    outputSchema: z.string().describe('The search results with current information'),
  };
}

/**
 * Web Search Tool Implementation
 */
export async function webSearchToolImplementation(input: { query: string }): Promise<string> {
  console.log(`🔍 Web Search Tool called with query: "${input.query}"`);
  
  try {
    const result = await callTavilySearch(input.query);
    console.log(`✅ Web Search Tool result: ${result.substring(0, 100)}...`);
    return result;
  } catch (error) {
    console.error('❌ Web Search Tool error:', error);
    // Return a fallback message instead of throwing
    return 'Unable to fetch current data. Please use typical values based on recent patterns.';
  }
}

/**
 * Specific helper functions for common newspaper data
 */

export async function fetchCurrentFuelPrices(): Promise<string> {
  return webSearchToolImplementation({
    query: 'Current petrol and diesel prices in Mumbai, Delhi, Bangalore, Chennai, and Kolkata today',
  });
}

export async function fetchCurrentMarketData(): Promise<string> {
  return webSearchToolImplementation({
    query: 'Current Sensex, Nifty 50, Gold price per 10g, Bitcoin and Ethereum prices in India today',
  });
}

export async function fetchCurrentWeather(): Promise<string> {
  return webSearchToolImplementation({
    query: 'Current weather in Mumbai, Delhi, Bangalore, Chennai with temperature and conditions today',
  });
}

export async function fetchLatestMovieReleases(): Promise<string> {
  return webSearchToolImplementation({
    query: 'New movies releasing this week in India, latest OTT releases on Netflix and Prime Video',
  });
}

export async function fetchLatestSportsScores(): Promise<string> {
  return webSearchToolImplementation({
    query: 'Latest cricket, football, and tennis scores and results from today',
  });
}
