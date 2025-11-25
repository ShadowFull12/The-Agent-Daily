import { genkitPlugin, Plugin } from 'genkit';
import { ModelMiddleware } from '@genkit-ai/ai/model';

export interface OpenRouterPluginParams {
  apiKey: string;
}

export const openrouter: Plugin<[OpenRouterPluginParams] | []> = genkitPlugin(
  'openrouter',
  async (params?: OpenRouterPluginParams) => {
    const apiKey = params?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    return {
      models: [
        {
          name: 'openrouter/grok-beta',
          supports: {
            multiturn: true,
            media: false,
            tools: false,
            systemRole: true,
            output: ['text'],
          },
          middleware: [
            async (req, next) => {
              // Convert Genkit request to OpenRouter format
              const messages = req.messages.map((msg: any) => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.content.map((part: any) => part.text).join('\n'),
              }));

              const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`,
                  'HTTP-Referer': 'https://github.com/ShadowFull12/The-Agent-Daily',
                  'X-Title': 'The Daily Agent',
                },
                body: JSON.stringify({
                  model: 'x-ai/grok-beta',
                  messages,
                  temperature: req.config?.temperature || 0.7,
                  max_tokens: req.config?.maxOutputTokens || 4000,
                }),
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenRouter API error: ${error}`);
              }

              const data = await response.json();
              
              return {
                message: {
                  role: 'model',
                  content: [{
                    text: data.choices[0].message.content,
                  }],
                },
                finishReason: 'stop',
              };
            },
          ] as ModelMiddleware[],
        },
      ],
    };
  }
);
