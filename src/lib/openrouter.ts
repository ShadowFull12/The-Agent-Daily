'use server';

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

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment variables');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/ShadowFull12/The-Agent-Daily',
      'X-Title': 'The Daily Agent',
    },
    body: JSON.stringify({
      model: options.model || 'moonshot/kimi-k2-thinking',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0].message.content;
}

export async function callKimi(userPrompt: string, systemPrompt?: string): Promise<string> {
  const messages: OpenRouterMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: userPrompt });
  
  return callOpenRouter(messages, { model: 'moonshot/kimi-k2-thinking' });
}

// Legacy function for backward compatibility
export async function callGrok(userPrompt: string, systemPrompt?: string): Promise<string> {
  return callKimi(userPrompt, systemPrompt);
}
