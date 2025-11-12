// types/whisper-node.d.ts
// Type declarations for whisper-node module
// Based on usage: whisper(filePath: string, options?: { modelName?: string; whisperOptions?: { language?: string } }) => Promise<Array<{ speech: string }>>

declare module "whisper-node" {
  export function whisper(
    filePath: string,
    options?: {
      modelName?: string;
      whisperOptions?: {
        language?: string;
      };
    }
  ): Promise<Array<{ speech: string }>>;

  // Optional: Export types for more advanced usage if needed
  export interface WhisperOptions {
    modelName?: string;
    whisperOptions?: {
      language?: string;
      [key: string]: any; // For additional options like temperature, etc.
    };
  }

  export interface WhisperSegment {
    speech: string;
    // Add more fields if known, e.g., start?: number; end?: number; confidence?: number;
  }
}
