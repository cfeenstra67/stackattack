// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// 2. Define your collection(s)
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};