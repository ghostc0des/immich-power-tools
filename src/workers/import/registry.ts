import type { ImportProcessor } from "./types";

const processors = new Map<string, ImportProcessor>();

export function registerProcessor(platform: string, processor: ImportProcessor) {
  processors.set(platform, processor);
}

export function getProcessor(platform: string): ImportProcessor {
  const processor = processors.get(platform);
  if (!processor) {
    throw new Error(`No import processor registered for platform: ${platform}`);
  }
  return processor;
}
