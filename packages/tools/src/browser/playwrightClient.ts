import { chromium, type Browser, type Page } from 'playwright';

export class PlaywrightClient {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.page = await this.browser.newPage();
    }
  }

  async open(url: string): Promise<void> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    await this.page.goto(url);
  }

  async click(selector: string): Promise<void> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    await this.page.click(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    await this.page.fill(selector, text);
  }

  async evaluate(script: string): Promise<unknown> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    return await this.page.evaluate(script);
  }

  async screenshot(): Promise<string> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    const buffer = await this.page.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  async consoleLogs(): Promise<Array<{ type: string; text: string }>> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    const logs: Array<{ type: string; text: string }> = [];
    
    this.page.on('console', (msg) => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    return logs;
  }

  async networkRequests(): Promise<Array<{ url: string; method: string; status?: number }>> {
    await this.init();
    if (!this.page) throw new Error('Page not initialized');
    const requests: Array<{ url: string; method: string; status?: number }> = [];

    this.page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
      });
    });

    this.page.on('response', (response) => {
      const request = requests.find((r) => r.url === response.url());
      if (request) {
        request.status = response.status();
      }
    });

    return requests;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

