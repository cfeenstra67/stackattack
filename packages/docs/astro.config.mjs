import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const googleAnalyticsId = 'G-2C44VGJN2K';

// https://astro.build/config
export default defineConfig({
  site: 'https://stackattack.camfeenstra.com',
  integrations: [starlight({
    title: 'StackAttack AWS',
    description: 'Production-ready AWS infrastructure components for Pulumi - Deploy secure, scalable applications with minimal infrastructure as code',
    favicon: '/favicon.ico',
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
          { label: 'Setting up Pulumi', link: '/working-with-pulumi/setting-up-pulumi' },
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
      // SEO meta tags
      {
        tag: 'meta',
        attrs: {
          name: 'keywords',
          content: 'pulumi, aws, infrastructure as code, typescript, devops, cloud, serverless, containers, ecs, s3, rds, vpc, terraform alternative',
        },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'author',
          content: 'StackAttack',
        },
      },
      {
        tag: 'meta',
        attrs: {
          property: 'og:type',
          content: 'website',
        },
      },
      {
        tag: 'meta',
        attrs: {
          property: 'og:site_name',
          content: 'StackAttack AWS',
        },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
      },
      // Google Analytics
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
