import type { Message } from '@my-ai-ide/shared';

export interface ModelClient {
  streamChat(messages: Message[]): AsyncGenerator<string, void, unknown>;
}

export interface ModelConfig {
  provider: 'ollama-cloud' | 'ollama-local' | 'openai';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

