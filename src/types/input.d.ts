// types/input.d.ts
// Type declarations for input module (CLI input for GramJS auth)
// Based on usage: input.text(prompt: string) => Promise<string>

declare module "input" {
  export function text(prompt: string): Promise<string>;
}
