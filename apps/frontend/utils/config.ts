// Backend API configuration
export const getBackendUrl = (): string => {
  // In browser, use the environment variable or default to localhost
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  }
  // Server-side, use the environment variable or default
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
};

export const BACKEND_URL = getBackendUrl();

