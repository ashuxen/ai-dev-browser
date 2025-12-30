import Store from 'electron-store';

// AI Provider configurations
export interface AIProvider {
  id: string;
  name: string;
  description: string;
  isFree: boolean;
  requiresApiKey: boolean;
  models: AIModel[];
  baseUrl: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
}

export interface AIConfig {
  selectedProvider: string;
  selectedModel: string;
  apiKeys: { [providerId: string]: string };
}

interface StoreSchema {
  aiConfig: AIConfig;
}

// Available AI Providers
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Free tier: 15 requests/minute, 1M tokens/day',
    isFree: true,
    requiresApiKey: true, // Free API key from Google AI Studio
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient', maxTokens: 8192 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable', maxTokens: 8192 },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Free tier: Fast inference, generous limits',
    isFree: true,
    requiresApiKey: true, // Free API key from Groq
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Powerful open model', maxTokens: 8192 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast responses', maxTokens: 8192 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Great for coding', maxTokens: 32768 },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple models, some free options',
    isFree: true,
    requiresApiKey: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', description: 'Free model', maxTokens: 4096 },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', description: 'Free model', maxTokens: 4096 },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', description: 'Free model', maxTokens: 4096 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'ChatGPT models (requires subscription/API key)',
    isFree: false,
    requiresApiKey: true,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', maxTokens: 16384 },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable', maxTokens: 16384 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Latest GPT-4', maxTokens: 4096 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models (requires API key)',
    isFree: false,
    requiresApiKey: true,
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best for coding', maxTokens: 8192 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient', maxTokens: 8192 },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run AI locally on your machine',
    isFree: true,
    requiresApiKey: false,
    baseUrl: 'http://localhost:11434/api',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', description: 'Local model', maxTokens: 4096 },
      { id: 'codellama', name: 'CodeLlama', description: 'Optimized for code', maxTokens: 4096 },
      { id: 'mistral', name: 'Mistral', description: 'Fast local model', maxTokens: 4096 },
    ],
  },
];

export class AIService {
  private store: Store<StoreSchema>;
  private conversationHistory: { role: string; content: string }[] = [];

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'ai-config',
      defaults: {
        aiConfig: {
          selectedProvider: 'groq', // Default to Groq (free and fast)
          selectedModel: 'llama-3.3-70b-versatile',
          apiKeys: {},
        },
      },
    });
  }

  getConfig(): AIConfig {
    return this.store.get('aiConfig');
  }

  setConfig(config: Partial<AIConfig>): void {
    const current = this.getConfig();
    this.store.set('aiConfig', { ...current, ...config });
  }

  setApiKey(providerId: string, apiKey: string): void {
    const config = this.getConfig();
    config.apiKeys[providerId] = apiKey;
    this.store.set('aiConfig', config);
  }

  getApiKey(providerId: string): string | undefined {
    return this.getConfig().apiKeys[providerId];
  }

  getProviders(): AIProvider[] {
    return AI_PROVIDERS;
  }

  getCurrentProvider(): AIProvider | undefined {
    const config = this.getConfig();
    return AI_PROVIDERS.find(p => p.id === config.selectedProvider);
  }

  getCurrentModel(): AIModel | undefined {
    const provider = this.getCurrentProvider();
    const config = this.getConfig();
    return provider?.models.find(m => m.id === config.selectedModel);
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  async chat(message: string, context?: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const config = this.getConfig();
    const provider = this.getCurrentProvider();

    if (!provider) {
      return { success: false, error: 'No AI provider selected' };
    }

    const apiKey = config.apiKeys[provider.id];
    
    if (provider.requiresApiKey && !apiKey) {
      return {
        success: false,
        error: `Please add your ${provider.name} API key in Settings.\n\n` +
          this.getApiKeyInstructions(provider.id),
      };
    }

    // Build the message with context
    let fullMessage = message;
    if (context) {
      fullMessage = `Context (current page URL): ${context}\n\nUser question: ${message}`;
    }

    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: fullMessage });

    try {
      let response: string;

      switch (provider.id) {
        case 'gemini':
          response = await this.callGemini(apiKey, config.selectedModel, fullMessage);
          break;
        case 'groq':
          response = await this.callOpenAICompatible(provider.baseUrl, apiKey, config.selectedModel);
          break;
        case 'openrouter':
          response = await this.callOpenRouter(apiKey, config.selectedModel);
          break;
        case 'openai':
          response = await this.callOpenAICompatible(provider.baseUrl, apiKey, config.selectedModel);
          break;
        case 'anthropic':
          response = await this.callAnthropic(apiKey, config.selectedModel);
          break;
        case 'ollama':
          response = await this.callOllama(config.selectedModel, fullMessage);
          break;
        default:
          return { success: false, error: 'Unknown provider' };
      }

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: response });

      return { success: true, content: response };
    } catch (error: any) {
      console.error('AI Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get AI response',
      };
    }
  }

  private getApiKeyInstructions(providerId: string): string {
    const instructions: { [key: string]: string } = {
      gemini: '🔑 Get FREE API key:\n1. Go to https://aistudio.google.com/apikey\n2. Click "Create API Key"\n3. Copy and paste it in Settings',
      groq: '🔑 Get FREE API key:\n1. Go to https://console.groq.com/keys\n2. Create an account (free)\n3. Generate API key\n4. Paste it in Settings',
      openrouter: '🔑 Get API key:\n1. Go to https://openrouter.ai/keys\n2. Create account\n3. Add credits or use free models\n4. Generate API key',
      openai: '🔑 Get API key:\n1. Go to https://platform.openai.com/api-keys\n2. Create new secret key\n3. Note: Requires payment/credits',
      anthropic: '🔑 Get API key:\n1. Go to https://console.anthropic.com/\n2. Create account and add credits\n3. Generate API key',
    };
    return instructions[providerId] || '';
  }

  private async callGemini(apiKey: string, model: string, message: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  }

  private async callOpenAICompatible(baseUrl: string, apiKey: string, model: string): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }

  private async callOpenRouter(apiKey: string, model: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://flashappai.org',
        'X-Title': 'FlashAppAI Browser',
      },
      body: JSON.stringify({
        model,
        messages: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }

  private async callAnthropic(apiKey: string, model: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API error');
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No response';
  }

  private async callOllama(model: string, message: string): Promise<string> {
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Ollama not running. Start Ollama first.');
      }

      const data = await response.json();
      return data.message?.content || 'No response';
    } catch (error: any) {
      if (error.message.includes('fetch')) {
        throw new Error('Ollama not running.\n\n1. Install Ollama from https://ollama.ai\n2. Run: ollama run llama3.2\n3. Try again');
      }
      throw error;
    }
  }

  async explainCode(code: string, language?: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const prompt = `Please explain this ${language || 'code'} in detail:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nExplain what it does, how it works, and any important concepts.`;
    return this.chat(prompt);
  }

  async summarizePage(content: string, url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const prompt = `Summarize the key points from this webpage (${url}):\n\n${content.substring(0, 4000)}\n\nProvide a concise summary with the main points.`;
    return this.chat(prompt);
  }

  async suggestImprovements(code: string, language?: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const prompt = `Review this ${language || 'code'} and suggest improvements:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nSuggest improvements for readability, performance, and best practices.`;
    return this.chat(prompt);
  }

  async debugHelp(code: string, error?: string, language?: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const prompt = `Help me debug this ${language || 'code'}:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\n${error ? `Error message: ${error}\n\n` : ''}What could be wrong and how can I fix it?`;
    return this.chat(prompt);
  }
}


