// 1. Import utilities from `astro:content`
import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// 2. Import loader(s)
import { glob } from 'astro/loaders';

// 3. Define your collection(s)
const components = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './components' }),
  schema: z.object({
    date: z.date(),
    package: z.string(),
    tags: z.array(z.string())
  })
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  components,
};
