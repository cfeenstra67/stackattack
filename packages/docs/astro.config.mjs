import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const googleAnalyticsId = 'G-2C44VGJN2K';

// https://astro.build/config
export default defineConfig({
  site: 'https://stackattack.camfeenstra.com',
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
        label: 'Working with Pulumi',
        items: [
          { label: 'Choosing a Backend', link: '/working-with-pulumi/choosing-a-backend' },
          { label: 'Structuring Stacks', link: '/working-with-pulumi/structuring-stacks' },
        ]
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
    head: [
      // Adding google analytics
      {
        tag: 'script',
        attrs: {
          src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
        },
      },
      {
        tag: 'script',
        content: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', '${googleAnalyticsId}');
        `,
      },
    ],
  })]
});
