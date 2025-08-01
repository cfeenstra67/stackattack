---
title: Introduction
description: Production-ready AWS infrastructure components for Pulumi
---

Stackattack provides a curated collection of high-level infrastructure components built on top of Pulumi. It allows you to deploy your applications on robust, secure infrastructure without giving up any control or spending days putting it together. Components are just functions, making them copy-paste friendly, so you can choose to use Stackattack as a library or just a set of working examples that you can take and modify for your own purposes.

## Philosophy

Stackattack was created for one simple reason: **there's too much code needed to get up and running with infra-as-code**. Most of the time, putting up infrastructure with IaC tools requires a slow, iterative process of reading Pulumi/Terraform docs, cross-referencing them with AWS docs, and trial-and-error to get things working.

Most of the time, what you really want is to get something working quickly with reasonable defaults, then make adjustments if you have more specific requirements. Stackattack aims to be the best way to get started setting up infrastructure managed by Pulumi.

Stackattack exposes a set of simple, self-contained building blocks that can be composed to quickly set up working infrastructure with all of the benefits of infra-as-code: you can modify your infrastructure with a typical PR-based development workflow, your infrastructure configs are versioned alongside the rest of your code, and you can easily deploy additional copies of your infrastructure as needed.

Components are designed intentionally as functions with as few abstractions as possible, making it easy for you to start using them with existing Pulumi code, copy/paste and modify them, or just treat them as working examples that you can use to get started writing your own components.

## Quick Example

Stackattack is comprised of individual components. Each components saves you dozens to hundreds of lines of configuration code, and is configured to be secure by default. The following is all the code needed to deploy a static Astro site (just like [this one](https://github.com/cfeenstra67/stackattack/blob/main/packages/docs/infra.ts)!).

```ts
import * as saws from '@stackattack/aws';

const ctx = saws.context();

const bucket = saws.bucket(ctx, { paths: ["./dist"] });

saws.staticSite(ctx, {
  bucket,
  domain: "www.mysite.com",
  adapter: saws.astroAdapter(),
});
```

## Next Steps

Ready to get started? Here's your path forward:

**[Installation](/getting-started/installation/)**  
Set up Stackattack in your project

**[Quick Start](/getting-started/quick-start/)**  
Build your first infrastructure stack with Stackattack

**[Components](/components/)**  
Explore the available infrastructure components
