import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import Store from 'electron-store';

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'auto';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface AIResponse {
  success: boolean;
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private store: Store<{ aiConfig: AIConfig }>;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    this.store = new Store({
      name: 'ai-config',
      defaults: {
        aiConfig: {
          provider: 'auto',
          maxTokens: 4096,
          temperature: 0.7,
        },
      },
    });

    this.initializeClients();
  }

  private initializeClients(): void {
    const config = this.store.get('aiConfig');

    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  /**
   * Configure the AI service
   */
  configure(config: Partial<AIConfig>): void {
    const currentConfig = this.store.get('aiConfig');
    const newConfig = { ...currentConfig, ...config };
    this.store.set('aiConfig', newConfig);
    this.initializeClients();
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig {
    return this.store.get('aiConfig');
  }

  /**
   * Explain code using AI
   */
  async explainCode(code: string, language?: string): Promise<AIResponse> {
    const prompt = `Explain the following ${language || 'code'} in detail. Include:
1. What the code does
2. Key concepts used
3. Potential issues or improvements
4. Example usage if applicable

\`\`\`${language || ''}
${code}
\`\`\``;

    return this.query(prompt, 'You are an expert programmer who explains code clearly and concisely.');
  }

  /**
   * Summarize documentation
   */
  async summarizeDocs(content: string): Promise<AIResponse> {
    const prompt = `Summarize the following documentation. Include:
1. Main purpose/overview
2. Key features or concepts
3. Important methods/functions
4. Code examples (if any)
5. Common use cases

Documentation:
${content}`;

    return this.query(prompt, 'You are a technical writer who creates clear, concise documentation summaries.');
  }

  /**
   * Chat with AI assistant
   */
  async chat(message: string, context?: string): Promise<AIResponse> {
    // Add context if provided
    let prompt = message;
    if (context) {
      prompt = `Context:\n${context}\n\nUser message: ${message}`;
    }

    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: prompt });

    const response = await this.query(
      prompt,
      'You are an AI assistant helping developers with coding tasks, documentation, and technical questions.',
      this.conversationHistory
    );

    if (response.success) {
      this.conversationHistory.push({ role: 'assistant', content: response.content });
    }

    return response;
  }

  /**
   * Generate code from description
   */
  async generateCode(description: string, language: string): Promise<AIResponse> {
    const prompt = `Generate ${language} code based on the following description:

${description}

Requirements:
- Write clean, well-commented code
- Follow best practices for ${language}
- Include error handling where appropriate
- Make the code production-ready`;

    return this.query(prompt, `You are an expert ${language} developer who writes clean, efficient code.`);
  }

  /**
   * Review code for issues
   */
  async reviewCode(code: string, language?: string): Promise<AIResponse> {
    const prompt = `Review the following ${language || 'code'} for:
1. Bugs or potential issues
2. Security vulnerabilities
3. Performance optimizations
4. Code style improvements
5. Best practice violations

\`\`\`${language || ''}
${code}
\`\`\`

Provide specific, actionable feedback.`;

    return this.query(prompt, 'You are a senior code reviewer with expertise in security and performance.');
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Main query function
   */
  private async query(
    prompt: string,
    systemPrompt: string,
    history?: ChatMessage[]
  ): Promise<AIResponse> {
    const config = this.store.get('aiConfig');

    // Determine which provider to use
    let provider = config.provider;
    if (provider === 'auto') {
      provider = this.anthropic ? 'anthropic' : this.openai ? 'openai' : 'auto';
    }

    if (provider === 'anthropic' && this.anthropic) {
      return this.queryAnthropic(prompt, systemPrompt, history);
    } else if (provider === 'openai' && this.openai) {
      return this.queryOpenAI(prompt, systemPrompt, history);
    } else {
      return {
        success: false,
        content: '',
        provider: 'none',
        model: 'none',
        error: 'No AI provider configured. Please add an API key in settings.',
      };
    }
  }

  /**
   * Query OpenAI
   */
  private async queryOpenAI(
    prompt: string,
    systemPrompt: string,
    history?: ChatMessage[]
  ): Promise<AIResponse> {
    if (!this.openai) {
      return {
        success: false,
        content: '',
        provider: 'openai',
        model: 'none',
        error: 'OpenAI client not initialized',
      };
    }

    const config = this.store.get('aiConfig');
    const model = config.model || 'gpt-4-turbo-preview';

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (history) {
        messages.push(...history.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      });

      const content = completion.choices[0]?.message?.content || '';

      return {
        success: true,
        content,
        provider: 'openai',
        model,
        tokensUsed: completion.usage?.total_tokens,
      };
    } catch (error) {
      console.error('[AIService] OpenAI error:', error);
      return {
        success: false,
        content: '',
        provider: 'openai',
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query Anthropic
   */
  private async queryAnthropic(
    prompt: string,
    systemPrompt: string,
    history?: ChatMessage[]
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      return {
        success: false,
        content: '',
        provider: 'anthropic',
        model: 'none',
        error: 'Anthropic client not initialized',
      };
    }

    const config = this.store.get('aiConfig');
    const model = config.model || 'claude-3-5-sonnet-20241022';

    try {
      const messages: Anthropic.MessageParam[] = [];

      if (history) {
        messages.push(...history.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const message = await this.anthropic.messages.create({
        model,
        max_tokens: config.maxTokens || 4096,
        system: systemPrompt,
        messages,
      });

      const content = message.content[0]?.type === 'text' 
        ? message.content[0].text 
        : '';

      return {
        success: true,
        content,
        provider: 'anthropic',
        model,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      };
    } catch (error) {
      console.error('[AIService] Anthropic error:', error);
      return {
        success: false,
        content: '',
        provider: 'anthropic',
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}



