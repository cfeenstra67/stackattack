import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
// 1. Import utilities from `astro:content`
import { defineCollection, z } from "astro:content";

// 2. Define your collection(s)
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        sourceUrl: z.string().optional(),
      }),
    }),
  }),
};
