
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

async function fetchNewsForTopic(topic: string): Promise<any[]> {
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
        throw new Error("NEWSDATA_API_KEY is not set in the environment variables.");
    }
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&language=en&category=${topic.toLowerCase()}&size=5&prioritydomain=top`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`API request failed for topic ${topic} with status: ${response.status}`);
            const errorBody = await response.text();
            console.error('Error Body:', errorBody);
            return [];
        }
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error(`Error fetching news for topic ${topic}:`, error);
        return [];
    }
}


export async function searchBreakingNews(input: SearchBreakingNewsInput): Promise<SearchBreakingNewsOutput> {
  const allStories: SearchBreakingNewsOutput['stories'] = [];
  const topicsToSearch = ["top", ...input.topics];

  for (const topic of topicsToSearch) {
    const apiResults = await fetchNewsForTopic(topic);
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


  return { stories: uniqueStories };
}
