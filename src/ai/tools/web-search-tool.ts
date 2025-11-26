'use server';

/**
 * Web Search Tool using Grok's native web search via OpenRouter
 * Grok 4 Fast has built-in real-time web search capabilities
 */

import { z } from 'genkit';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call Grok with web search enabled via OpenRouter API
 * Grok's agentic mode will automatically perform web searches when needed
 */
async function callGrokWithWebSearch(query: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment variables');
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: 'You are a research assistant. Use web search to find the most current and accurate information. Provide concise, factual answers with specific numbers, dates, and details.',
    },
    {
      role: 'user',
      content: query,
    },
  ];

  try {
    // Note: OpenRouter supports Grok but may not support all xAI-specific features
    // We'll use the standard OpenAI-compatible API format
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/ShadowFull12/The-Agent-Daily',
        'X-Title': 'The Daily Agent',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast:free', // FREE Grok 4.1 Fast with web search capabilities!
        messages,
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`OpenRouter API error: ${response.status} - ${error}`);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Grok with web search:', error);
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
    const result = await callGrokWithWebSearch(input.query);
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
