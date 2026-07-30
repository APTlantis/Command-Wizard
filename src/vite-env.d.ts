/// <reference types="vite/client" />

interface Window {
  Prism?: {
    languages: Record<string, unknown>;
    highlight: (code: string, grammar: unknown, language: string) => string;
  };
}
