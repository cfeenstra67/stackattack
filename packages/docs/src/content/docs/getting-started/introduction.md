---
title: Introduction
description: Introduction to StackAttack AWS components
---

# Introduction

StackAttack AWS is a collection of production-ready infrastructure components built on top of Pulumi. It provides a higher-level abstraction over AWS resources, making it easier to build secure, scalable, and maintainable infrastructure.

## Why StackAttack AWS?

- **Reduced boilerplate**: Common patterns are abstracted into reusable components
- **Best practices built-in**: Security, monitoring, and operational best practices are included by default
- **Consistent patterns**: All components follow the same naming, tagging, and configuration conventions
- **Type safety**: Full TypeScript support with comprehensive type definitions

## Core Concepts

### Context
The `Context` is the foundation of StackAttack AWS. It provides consistent resource naming, tagging, and organization across all components.

### Components
Components are high-level abstractions that create multiple related AWS resources. For example, the `vpc` component creates a VPC, subnets, route tables, and internet gateway.

### Composability
Components are designed to work together seamlessly. Outputs from one component can be easily used as inputs to another.

## Next Steps

- [Installation](/getting-started/installation/) - Set up StackAttack AWS in your project
- [Quick Start](/getting-started/quick-start/) - Build your first infrastructure with StackAttack AWS