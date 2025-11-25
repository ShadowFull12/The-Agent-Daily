
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

// Mock data fallback for when API is unavailable
function getMockNewsForTopic(topic: string, size: number): any[] {
    console.log(`📰 Using mock data for topic: ${topic}`);
    const mockStories = [
        {
            title: `Breaking: Major ${topic} development announced today`,
            link: `https://example.com/${topic}/story1`,
            image_url: `https://picsum.photos/seed/${topic}1/400/300`,
            description: `Latest ${topic} news: Important developments in the ${topic} sector that are making headlines worldwide.`,
            category: [topic],
        },
        {
            title: `${topic} update: New trends emerging globally`,
            link: `https://example.com/${topic}/story2`,
            image_url: `https://picsum.photos/seed/${topic}2/400/300`,
            description: `Experts analyze the latest ${topic} trends and their impact on the global landscape.`,
            category: [topic],
        },
        {
            title: `Exclusive ${topic} report reveals key insights`,
            link: `https://example.com/${topic}/story3`,
            image_url: `https://picsum.photos/seed/${topic}3/400/300`,
            description: `In-depth coverage of critical ${topic} events that are shaping the future.`,
            category: [topic],
        },
    ];
    
    return mockStories.slice(0, size);
}

async function fetchNewsForTopic(topic: string, size: number): Promise<any[]> {
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
        console.warn("⚠️ NEWSDATA_API_KEY not set, using mock data");
        return getMockNewsForTopic(topic, size);
    }
    
    // Use 'top' as a general priority topic, and specific categories otherwise
    const categoryQuery = topic.toLowerCase() === 'top' ? '' : `&category=${topic.toLowerCase()}`;
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&language=en${categoryQuery}&size=${size}&prioritydomain=top`;

    try {
        console.log(`🔍 Fetching news for topic: ${topic}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error(`API request failed for topic ${topic} with status: ${response.status}`);
            const errorBody = await response.text();
            console.error('Error Body:', errorBody);
            
            // Return mock data on API failure (429 or other errors)
            console.log(`⚠️ Falling back to mock data for topic: ${topic}`);
            return getMockNewsForTopic(topic, size);
        }
        const data = await response.json();
        console.log(`✅ Fetched ${data.results?.length || 0} stories for topic: ${topic}`);
        return data.results || [];
    } catch (error) {
        console.error(`Error fetching news for topic ${topic}:`, error);
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`⏱️ Request timed out for topic ${topic}`);
        }
        // Return mock data on any error
        console.log(`⚠️ Falling back to mock data for topic: ${topic}`);
        return getMockNewsForTopic(topic, size);
    }
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
