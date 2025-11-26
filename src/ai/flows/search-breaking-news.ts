
'use server';

/**
 * @fileOverview A flow for searching breaking news stories using the Newsdata.io API.
 *
 * - searchBreakingNews - A function that handles the search for breaking news.
 * - SearchBreakingNewsInput - The input type for the searchBreakingNews function.
 * - SearchBreakingNewsOutput - The return type for the searchBreakingNews function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SearchBreakingNewsInputSchema = z.object({
  topics: z
    .array(z.string())
    .describe('An array of topics (categories) to search for breaking news about. See Newsdata.io docs for available categories.'),
  limit: z.number().optional().default(10).describe('The number of stories to return per topic.'),
});
export type SearchBreakingNewsInput = z.infer<typeof SearchBreakingNewsInputSchema>;

const SearchBreakingNewsOutputSchema = z.object({
  stories: z.array(
    z.object({
      topic: z.string().describe('The topic of the story.'),
      title: z.string().describe('The title of the story.'),
      url: z.string().url().describe('The URL of the story.'),
      imageUrl: z.string().url().optional().describe('A valid, publicly accessible image URL for the story, if available.'),
      content: z.string().optional().describe('The content or description of the article.'),
    })
  ).describe('A list of breaking news stories found for the specified topics.'),
});
export type SearchBreakingNewsOutput = z.infer<typeof SearchBreakingNewsOutputSchema>;

async function fetchNewsForTopic(topic: string, size: number): Promise<any[]> {
    // Multiple API keys with fallback logic
    const apiKeys = [
        process.env.NEWSDATA_API_KEY,
        process.env.NEWSDATA_API_KEY_2,
        process.env.NEWSDATA_API_KEY_3,
    ].filter(Boolean) as string[]; // Remove undefined/empty keys
    
    if (apiKeys.length === 0) {
        throw new Error("No NEWSDATA_API_KEY is set in the environment variables.");
    }
    
    // Use 'top' as a general priority topic, and specific categories otherwise
    const categoryQuery = topic.toLowerCase() === 'top' ? '' : `&category=${topic.toLowerCase()}`;
    
    // Try each API key until one succeeds
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&language=en${categoryQuery}&size=${size}&prioritydomain=top`;

        try {
            console.log(`🔍 [API Key ${i + 1}/${apiKeys.length}] Fetching news for topic: ${topic}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log(`⏱️ Timeout triggered for topic: ${topic}`);
                controller.abort();
            }, 30000); // 30 second timeout
            
            const startTime = Date.now();
            const response = await fetch(url, { signal: controller.signal });
            const fetchTime = Date.now() - startTime;
            clearTimeout(timeoutId);
            
            console.log(`📡 Response received for ${topic} in ${fetchTime}ms, status: ${response.status}`);
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`❌ API Key ${i + 1} failed for topic ${topic} with status: ${response.status}`);
                console.error('Error Body:', errorBody);
                
                // If this is the last key, return empty array
                if (i === apiKeys.length - 1) {
                    console.error(`❌ All ${apiKeys.length} API keys exhausted for topic: ${topic}`);
                    return [];
                }
                
                // Otherwise, continue to next API key
                console.log(`🔄 Trying next API key for topic: ${topic}...`);
                continue;
            }
            
            const data = await response.json();
            console.log(`✅ Fetched ${data.results?.length || 0} stories for topic: ${topic} using API Key ${i + 1}`);
            return data.results || [];
            
        } catch (error) {
            console.error(`❌ Error with API Key ${i + 1} for topic ${topic}:`, error);
            if (error instanceof Error && error.name === 'AbortError') {
                console.error(`⏱️ Request timed out for topic ${topic} after 30 seconds`);
            }
            
            // If this is the last key, return empty array
            if (i === apiKeys.length - 1) {
                console.error(`❌ All ${apiKeys.length} API keys exhausted for topic: ${topic}`);
                return [];
            }
            
            // Otherwise, continue to next API key
            console.log(`🔄 Trying next API key for topic: ${topic}...`);
            continue;
        }
    }
    
    // Should never reach here, but just in case
    return [];
}


export async function searchBreakingNews(input: SearchBreakingNewsInput): Promise<SearchBreakingNewsOutput> {
  const allStories: SearchBreakingNewsOutput['stories'] = [];
  const topicsToSearch = ["top", ...input.topics];

  // Distribute the limit across the topics
  const limitPerTopic = Math.ceil(input.limit! / topicsToSearch.length);

  for (const topic of topicsToSearch) {
    const apiResults = await fetchNewsForTopic(topic, limitPerTopic);
    const storiesForTopic = apiResults.map(story => ({
      topic: story.category?.[0] || topic, // Use the category from the result if available
      title: story.title,
      url: story.link,
      imageUrl: story.image_url,
      content: story.description || story.content,
    })).filter(s => s.title && s.url && s.content); // Ensure essential fields are present

    allStories.push(...storiesForTopic);
  }

  // Post-process to add placeholder images if they are missing
  allStories.forEach(story => {
    if (!story.imageUrl || story.imageUrl.trim() === '') {
      const seed = story.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'default';
      story.imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
    }
  });

  // Remove duplicates by URL
  const uniqueStories = Array.from(new Map(allStories.map(s => [s.url, s])).values());


  return { stories: uniqueStories.slice(0, input.limit) };
}
