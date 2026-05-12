import type { BuildMetadata } from '@/lib/build-metadata';

declare global {
  const __BUILD_METADATA__: BuildMetadata;
}

export {};
