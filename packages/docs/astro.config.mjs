import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

const googleAnalyticsId = 'G-2C44VGJN2K';

// https://astro.build/config
export default defineConfig({
  site: 'https://stackattack.camfeenstra.com',
  integrations: [starlight({
    title: 'Stackattack',
    description: 'Production-ready AWS infrastructure components for Pulumi - Deploy secure, scalable applications with minimal code',
    favicon: '/favicon.ico',
    logo: {
      src: './src/assets/logo.svg',
      replacesTitle: true,
    },
    customCss: [
      './src/styles/custom.css',
    ],
    social: [
      {
        icon: 'github',
        label: 'GitHub',
        href: 'https://github.com/cfeenstra67/stackattack',
      },
    ],
    components: {
      PageTitle: './src/components/PageTitle.astro'
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
        autogenerate: { directory: 'utilities' },
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
          content: 'Stackattack',
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
          content: 'Stackattack',
        },
      },
      {
        tag: 'meta',
        attrs: {
          property: 'og:image',
          content: '/social-image.png'
        }
      },
      {
        tag: 'meta',
        attrs: {
          property: 'twitter:image',
          content: '/social-image.png'
        }
      },
      {
        tag: 'meta',
        attrs: {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'twitter:creator',
          content: '@camfeen67'
        }
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
      {
        tag: 'script',
        attrs: {
          type: 'application/ld+json',
        },
        content: `
          {
            "@context" : "https://schema.org",
            "@type" : "WebSite",
            "name" : "Stackattack",
            "url" : "https://stackattack.camfeenstra.com"
          }
        `
      }
    ],
    plugins: [starlightLlmsTxt()]
  })]
});
