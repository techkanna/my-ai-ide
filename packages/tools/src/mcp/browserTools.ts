import type { ToolDefinition } from '@my-ai-ide/agent-core';
import { PlaywrightClient } from '../browser/playwrightClient';

// Global browser client instance
let browserClient: PlaywrightClient | null = null;

function getBrowserClient(): PlaywrightClient {
  if (!browserClient) {
    browserClient = new PlaywrightClient();
  }
  return browserClient;
}

export function createMCPBrowserTools(): ToolDefinition[] {
  return [
    {
      name: 'browser.open',
      description: 'Open a URL in the browser',
      schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to open',
          },
        },
        required: ['url'],
      },
      execute: async (args) => {
        const url = args.url as string;
        const client = getBrowserClient();
        await client.open(url);
        return { success: true };
      },
    },
    {
      name: 'browser.click',
      description: 'Click an element on the page',
      schema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the element to click',
          },
        },
        required: ['selector'],
      },
      execute: async (args) => {
        const selector = args.selector as string;
        const client = getBrowserClient();
        await client.click(selector);
        return { success: true };
      },
    },
    {
      name: 'browser.type',
      description: 'Type text into an input element',
      schema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the input element',
          },
          text: {
            type: 'string',
            description: 'Text to type',
          },
        },
        required: ['selector', 'text'],
      },
      execute: async (args) => {
        const selector = args.selector as string;
        const text = args.text as string;
        const client = getBrowserClient();
        await client.type(selector, text);
        return { success: true };
      },
    },
    {
      name: 'browser.evaluate',
      description: 'Evaluate JavaScript in the page context',
      schema: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'JavaScript code to evaluate',
          },
        },
        required: ['script'],
      },
      execute: async (args) => {
        const script = args.script as string;
        const client = getBrowserClient();
        const result = await client.evaluate(script);
        return { result };
      },
    },
    {
      name: 'browser.screenshot',
      description: 'Take a screenshot of the current page',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const client = getBrowserClient();
        const screenshot = await client.screenshot();
        return { screenshot };
      },
    },
    {
      name: 'browser.console_logs',
      description: 'Get console logs from the page',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const client = getBrowserClient();
        const logs = await client.consoleLogs();
        return { logs };
      },
    },
    {
      name: 'browser.network_requests',
      description: 'Get network requests made by the page',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        const client = getBrowserClient();
        const requests = await client.networkRequests();
        return { requests };
      },
    },
  ];
}

