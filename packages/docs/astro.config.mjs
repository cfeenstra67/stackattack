import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [starlight({
    title: 'StackAttack AWS',
    description: 'AWS infrastructure components for Pulumi',
    logo: {
      src: './src/assets/logo.svg',
      replacesTitle: true,
    },
    customCss: [
      './src/styles/custom.css',
    ],
    social: {
      github: 'https://github.com/cfeenstra67/stackattack',
    },
    sidebar: [
      {
        label: 'Getting Started',
        items: [
          { label: 'Introduction', link: '/getting-started/introduction/' },
          { label: 'Installation', link: '/getting-started/installation/' },
          { label: 'Quick Start', link: '/getting-started/quick-start/' },
        ],
      },
      {
        label: 'Concepts',
        items: [
          { label: 'Context', link: '/concepts/context/' },
        ],
      },
      {
        label: 'Components',
        autogenerate: { directory: 'components' },
      },
      {
        label: 'Utilities',
        items: [
          { label: 'ARNs', link: '/utilities/arns/' },
          { label: 'Security Groups', link: '/utilities/security-groups/' },
          { label: 'Stack References', link: '/utilities/stack-references/' },
        ],
      },
    ],
  })]
});