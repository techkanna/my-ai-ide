/**
 * Screenshot encoding utilities for vision models
 */

export interface ScreenshotData {
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Encode a screenshot buffer to base64 with metadata
 */
export function encodeScreenshot(buffer: Buffer, format: 'png' | 'jpeg' = 'png'): ScreenshotData {
  const base64 = buffer.toString('base64');
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

  return {
    base64,
    mimeType,
  };
}

/**
 * Optimize screenshot for vision models
 * Reduces size while maintaining quality
 */
export function optimizeScreenshot(
  base64: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<string> {
  // This would typically use image processing libraries
  // For now, return as-is
  return Promise.resolve(base64);
}

/**
 * Format screenshot for model context
 */
export function formatScreenshotForModel(screenshot: ScreenshotData): string {
  return `data:${screenshot.mimeType};base64,${screenshot.base64}`;
}

