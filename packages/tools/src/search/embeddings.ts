/**
 * Code search with embeddings
 * This is a basic implementation - in production, you'd use a proper vector DB
 */

export interface CodeChunk {
  path: string;
  content: string;
  embedding?: number[];
  startLine: number;
  endLine: number;
}

export class CodeIndex {
  private chunks: CodeChunk[] = [];

  addChunk(chunk: CodeChunk): void {
    this.chunks.push(chunk);
  }

  addFile(path: string, content: string, chunkSize: number = 100): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk: CodeChunk = {
        path,
        content: lines.slice(i, i + chunkSize).join('\n'),
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
      };
      this.chunks.push(chunk);
    }
  }

  search(query: string, limit: number = 10): CodeChunk[] {
    // Simple text-based search (embeddings would require a model)
    const queryLower = query.toLowerCase();
    const results = this.chunks
      .map((chunk) => {
        const contentLower = chunk.content.toLowerCase();
        const score = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
        return { chunk, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.chunk);

    return results;
  }

  clear(): void {
    this.chunks = [];
  }

  getChunks(): CodeChunk[] {
    return this.chunks;
  }
}

// Simple cosine similarity (for when embeddings are available)
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

