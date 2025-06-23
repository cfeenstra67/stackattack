import * as fs from "node:fs";
import * as path from "node:path";
import {
  Application,
  DeclarationReflection,
  ParameterReflection,
  ReflectionKind,
} from "typedoc";

async function generateDocs() {
  // Bootstrap the application
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [
      "../aws/src/components",
      "../aws/src/arns.ts",
      "../aws/src/security-groups.ts",
      "../aws/src/stack-ref.ts",
    ],
    entryPointStrategy: "expand",
    tsconfig: "../aws/tsconfig.json",
    excludeExternals: true,
    excludePrivate: false,
    excludeProtected: false,
    exclude: ["../aws/src/components/logs.ts"], // Exclude internal helper file
  });

  // Generate documentation
  const project = await app.convert();
  if (!project) {
    throw new Error("Failed to convert project");
  }

  const componentsOutputDir = "./src/content/docs/components";
  const utilitiesOutputDir = "./src/content/docs/utilities";

  // Ensure output directories exist
  if (!fs.existsSync(componentsOutputDir)) {
    fs.mkdirSync(componentsOutputDir, { recursive: true });
  }
  if (!fs.existsSync(utilitiesOutputDir)) {
    fs.mkdirSync(utilitiesOutputDir, { recursive: true });
  }

  // Helper function to format TypeDoc comments
  // biome-ignore lint/suspicious/noExplicitAny: needed here
  function formatComment(comment?: any): string {
    if (!comment) return "";

    let text = "";
    if (comment.summary) {
      // biome-ignore lint/suspicious/noExplicitAny: needed here
      text += comment.summary.map((part: any) => part.text || "").join("");
    }
    return text.trim();
  }

  // Helper function to format parameter documentation
  function formatParameters(
    parameters?: ParameterReflection[],
    isUtility = false,
    hasMainFunction = true,
  ): string {
    if (!parameters || parameters.length === 0) return "";

    // Determine heading level: for utilities or when no main function, use ####
    // For components with main function, functions are ### so parameters should be ####
    const headingLevel = isUtility || !hasMainFunction ? "###" : "####";
    let result = `\n${headingLevel} Parameters\n\n`;
    for (const param of parameters) {
      const name = param.name;
      const typeStr = param.type?.toString() || "unknown";
      const linkedType = formatTypeWithLinks(typeStr);
      const description = formatComment(param.comment);
      const optional = param.flags.isOptional ? "?" : "";

      // Format type properly - add backticks around non-linked portions
      const formattedType = formatTypeAsCode(linkedType);
      // Clean up any extra spaces around links
      const cleanedType = formattedType
        .replace(/`\s+\[/g, "`[")
        .replace(/\]\s+`/g, "]`");
      result += `- **\`${name}${optional}\`** (${cleanedType}) - ${description}\n`;
    }
    return result;
  }

  // Helper function to format interface properties
  function formatInterfaceProperties(
    declaration: DeclarationReflection,
  ): string {
    const children = declaration.children?.filter(
      (child) => child.kind === ReflectionKind.Property,
    );
    if (!children || children.length === 0) return "";

    let result = "\n### Properties\n\n";
    for (const prop of children) {
      const name = prop.name;
      const typeStr = prop.type?.toString() || "unknown";
      const linkedType = formatTypeWithLinks(typeStr);
      const description = formatComment(prop.comment);
      const optional = prop.flags.isOptional ? "?" : "";

      // Format type properly - add backticks around non-linked portions
      const formattedType = formatTypeAsCode(linkedType);
      // Clean up any extra spaces around links
      const cleanedType = formattedType
        .replace(/`\s+\[/g, "`[")
        .replace(/\]\s+`/g, "]`");
      result += `- **\`${name}${optional}\`** (${cleanedType}) - ${description}\n`;
    }
    return result;
  }

  // Helper function to convert types to links where possible
  function formatTypeWithLinks(typeStr: string): string {
    // Simple heuristic: replace known type names with links
    let result = typeStr;
    for (const [typeName, typeInfo] of typeMap) {
      // Use word boundaries to avoid replacing partial matches
      const regex = new RegExp(`\\b${typeName}\\b`, "g");
      result = result.replace(
        regex,
        `[${typeName}](${typeInfo.componentName}${typeInfo.anchor})`,
      );
    }

    // Handle Context type (from context.ts, not in components)
    result = result.replace(/\bContext\b/g, "[Context](/concepts/context/)");

    return result;
  }

  // Helper function to wrap non-linked parts of types in backticks
  function formatTypeAsCode(typeStr: string): string {
    // For types that contain links, we need to be more careful
    // Split by markdown links and wrap only the non-link parts
    const linkRegex = /(\[[^\]]+\]\([^)]+\))/g;

    if (!linkRegex.test(typeStr)) {
      // No links, just wrap the whole thing
      return `\`${typeStr}\``;
    }

    // Has links - need to split and wrap parts carefully
    const parts = typeStr.split(linkRegex);
    let result = "";
    let currentCodeBlock = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part.match(linkRegex)) {
        // This is a markdown link
        if (currentCodeBlock) {
          result += `\`${currentCodeBlock}\``;
          currentCodeBlock = "";
        }
        // Add backticks inside the link
        const linkWithBackticks = part.replace(/\[([^\]]+)\]/, "[`$1`]");
        result += linkWithBackticks;
      } else if (part) {
        // This is regular text that should be in a code block
        currentCodeBlock += part;
      }
    }

    if (currentCodeBlock) {
      result += `\`${currentCodeBlock}\``;
    }

    return result;
  }

  // Helper function to format function signature
  function formatFunctionSignature(declaration: DeclarationReflection): string {
    const signatures = declaration.signatures;
    if (!signatures || signatures.length === 0) return "";

    const signature = signatures[0];
    const params =
      signature.parameters
        ?.map((p) => {
          const optional = p.flags.isOptional ? "?" : "";
          const typeStr = p.type?.toString() || "unknown";
          // Don't add links in code blocks - keep original types
          return `${p.name}${optional}: ${typeStr}`;
        })
        .join(", ") || "";

    const returnType = signature.type?.toString() || "void";
    // Don't add links in code blocks - keep original types

    return `\`\`\`typescript\nfunction ${declaration.name}(${params}): ${returnType}\n\`\`\``;
  }

  // Process component and utility files
  const componentFiles = new Map<string, DeclarationReflection[]>();
  const utilityFiles = new Map<string, DeclarationReflection[]>();

  // Build a global map of all types/interfaces for cross-linking
  const typeMap = new Map<string, { componentName: string; anchor: string }>();

  // Utility file name mappings
  const utilityNameMap: Record<string, string> = {
    arns: "arns",
    "security-groups": "security-groups",
    "stack-ref": "stack-references",
  };

  // Group declarations by source file
  for (const child of project.children ?? []) {
    if (child.sources && child.sources.length > 0) {
      const sourceFile = child.sources[0].fileName;
      const fileMatch = sourceFile.match(/^(.+)\.ts$/);

      if (fileMatch) {
        let fileName = fileMatch[1];

        // Handle components/ prefix for component files
        if (fileName.startsWith("components/")) {
          fileName = fileName.replace("components/", "");
        }

        // Check if this module is marked as @internal and should be excluded
        if (child.kind === ReflectionKind.Module && child.comment) {
          const comment = formatComment(child.comment);
          const hasInternalTag =
            comment.includes("@internal") ||
            child.comment.modifierTags?.has("@internal") ||
            child.comment.blockTags?.some((tag) => tag.tag === "@internal");
          if (hasInternalTag) {
            console.log(`Skipping @internal module: ${fileName}`);
            continue;
          }
        }

        // Determine if this is a component or utility file
        const isUtility = Object.hasOwn(utilityNameMap, fileName);
        const targetMap = isUtility ? utilityFiles : componentFiles;
        const targetName = isUtility ? utilityNameMap[fileName] : fileName;

        if (!targetMap.has(targetName)) {
          targetMap.set(targetName, []);
        }

        // If this is a module, get its children (the actual exports)
        if (child.kind === ReflectionKind.Module && child.children) {
          // Store the module itself for potential @packageDocumentation comment
          const moduleDecl = child as DeclarationReflection;
          targetMap.get(targetName)!.push(moduleDecl);

          for (const decl of child.children) {
            targetMap.get(targetName)!.push(decl);

            // Add to type map for cross-linking
            if (
              decl.kind === ReflectionKind.Interface ||
              decl.kind === ReflectionKind.TypeAlias
            ) {
              const linkPath = isUtility
                ? `/utilities/${targetName}`
                : `/components/${targetName}`;
              typeMap.set(decl.name, {
                componentName: linkPath,
                anchor: `#${decl.name.toLowerCase()}`,
              });
            }
          }
        } else {
          targetMap.get(targetName)!.push(child as DeclarationReflection);
        }
      }
    }
  }

  // Helper function to generate markdown documentation
  function generateMarkdown(
    name: string,
    declarations: DeclarationReflection[],
    isUtility = false,
  ): string {
    const docType = isUtility ? "utility" : "component";
    let markdown = `---\ntitle: ${name}\ndescription: ${name} ${docType} documentation\n---\n\n`;

    // Look for module-level documentation
    const moduleDecl = declarations.find(
      (d) => d.kind === ReflectionKind.Module,
    );
    if (moduleDecl?.comment) {
      const moduleDescription = formatComment(moduleDecl.comment);
      if (moduleDescription) {
        markdown += `${moduleDescription}\n\n`;
      }
    }

    // Filter out module declaration for other processing
    const nonModuleDeclarations = declarations.filter(
      (d) => d.kind !== ReflectionKind.Module,
    );

    // For utilities, don't look for a "main" function, just document all functions
    // For components, find the main component function
    let mainFunction: DeclarationReflection | undefined;
    if (!isUtility) {
      // Convert kebab-case file name to camelCase for function matching
      const camelCaseName = name.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );

      mainFunction = nonModuleDeclarations.find(
        (d) =>
          d.kind === ReflectionKind.Function &&
          (d.name === name || // exact match: "vpc" -> "vpc"
            d.name === camelCaseName || // camelCase: "email-domain" -> "emailDomain"
            d.name === name.replace(/-/g, "") || // no dashes: "load-balancer" -> "loadbalancer"
            d.name.toLowerCase() === name.toLowerCase().replace(/-/g, "")), // case insensitive
      );
    }

    if (mainFunction && mainFunction.kind === ReflectionKind.Function) {
      markdown += `## ${mainFunction.name}\n\n`;
      // Try to get comment from signature if not on function itself
      const comment =
        mainFunction.comment || mainFunction.signatures?.[0]?.comment;
      const description = formatComment(comment);
      if (description) {
        markdown += `${description}\n\n`;
      }
      markdown += `${formatFunctionSignature(mainFunction)}\n`;
      markdown += `${formatParameters(
        mainFunction.signatures?.[0]?.parameters,
        isUtility,
        true,
      )}\n`;
    }

    // Group remaining declarations by type
    const interfaces = nonModuleDeclarations.filter(
      (d) => d.kind === ReflectionKind.Interface && d !== mainFunction,
    );
    const functions = nonModuleDeclarations.filter(
      (d) => d.kind === ReflectionKind.Function && d !== mainFunction,
    );
    const types = nonModuleDeclarations.filter(
      (d) => d.kind === ReflectionKind.TypeAlias,
    );

    // Document functions
    if (functions.length > 0) {
      const heading =
        isUtility || !mainFunction ? "# Functions" : "## Functions";
      markdown += `${heading}\n\n`;
      for (const func of functions) {
        const funcHeading = isUtility || !mainFunction ? "## " : "### ";
        markdown += `${funcHeading}${func.name}\n\n`;
        // Try to get comment from signature if not on function itself
        const comment = func.comment || func.signatures?.[0]?.comment;
        const funcDescription = formatComment(comment);
        if (funcDescription) {
          markdown += `${funcDescription}\n\n`;
        }
        markdown += `${formatFunctionSignature(func)}\n`;
        markdown += `${formatParameters(
          func.signatures?.[0]?.parameters,
          isUtility,
          !!mainFunction,
        )}\n`;
      }
    }

    // Document interfaces
    if (interfaces.length > 0) {
      markdown += "## Interfaces\n\n";
      for (const iface of interfaces) {
        markdown += `### ${iface.name}\n\n`;
        const ifaceDescription = formatComment(iface.comment);
        if (ifaceDescription) {
          markdown += `${ifaceDescription}\n\n`;
        }
        markdown += `${formatInterfaceProperties(iface)}\n`;
      }
    }

    // Document types
    if (types.length > 0) {
      markdown += "## Types\n\n";
      for (const type of types) {
        markdown += `### ${type.name}\n\n`;
        const typeDescription = formatComment(type.comment);
        if (typeDescription) {
          markdown += `${typeDescription}\n\n`;
        }
        markdown += `\`\`\`typescript\ntype ${type.name} = ${
          type.type?.toString() || "unknown"
        }\n\`\`\`\n\n`;
      }
    }

    return markdown;
  }

  // Generate component documentation
  for (const [componentName, declarations] of componentFiles) {
    const markdown = generateMarkdown(componentName, declarations, false);
    const outputPath = path.join(componentsOutputDir, `${componentName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated documentation for ${componentName}`);
  }

  // Generate utility documentation
  for (const [utilityName, declarations] of utilityFiles) {
    const markdown = generateMarkdown(utilityName, declarations, true);
    const outputPath = path.join(utilitiesOutputDir, `${utilityName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated utility documentation for ${utilityName}`);
  }

  // Generate components index file
  const componentNames = Array.from(componentFiles.keys()).sort();
  const indexMarkdown = `---
title: Components
description: AWS infrastructure components for Pulumi
---

# Components

StackAttack provides opinionated, secure-by-default AWS infrastructure components built on top of Pulumi.

## Available Components

${componentNames
  .map((name) => {
    // Convert kebab-case to title case for display
    const displayName = name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return `- [${displayName}](/components/${name}/)`;
  })
  .join("\n")}

## Getting Started

All components follow the same basic pattern:

\`\`\`typescript
import * as saws from "@stackattack/aws";

const ctx = saws.context();
const component = saws.componentName(ctx, args);
\`\`\`

Each component is designed with secure defaults and can be customized through configuration arguments.
`;

  const indexPath = "./src/content/docs/components.md";
  fs.writeFileSync(indexPath, indexMarkdown);
  console.log("Generated components index file");

  console.log("Documentation generation complete!");
}

// Run the generation
generateDocs();
