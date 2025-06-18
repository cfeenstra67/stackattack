import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [starlight({
    title: 'StackAttack AWS',
    description: 'AWS infrastructure components for Pulumi',
    social: {
      github: 'https://github.com/your-org/stackattack',
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
          { label: 'Resource Naming', link: '/concepts/resource-naming/' },
          { label: 'Component Architecture', link: '/concepts/component-architecture/' },
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