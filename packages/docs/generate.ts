import * as fs from "node:fs";
import * as path from "node:path";
import {
  Application,
  DeclarationReflection,
  ParameterReflection,
  ReflectionKind,
  SignatureReflection,
} from "typedoc";

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
  parameters: ParameterReflection[] | undefined,
  typeMap: Map<string, { componentName: string; anchor: string }>,
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
    const linkedType = formatTypeWithLinks(typeStr, typeMap);
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

function formatReturnType(
  signature: SignatureReflection | undefined,
  typeMap: Map<string, { componentName: string; anchor: string }>,
  isUtility = false,
  hasMainFunction = true,
): string {
  if (!signature?.type) return "";

  const headingLevel = isUtility || !hasMainFunction ? "###" : "####";

  let result = `\n${headingLevel} Returns\n\n`;
  const typeStr = signature.type.toString();

  const linkedType = formatTypeWithLinks(typeStr, typeMap);
  const description = formatComment(signature.comment);

  const formattedType = formatTypeAsCode(linkedType);
  const cleanedType = formattedType
    .replace(/`\s+\[/g, "`[")
    .replace(/\]\s+`/g, "]`");

  result += `- (${cleanedType}) - ${description}\n`;

  return result;
}

// Helper function to convert types to links where possible
function formatTypeWithLinks(
  typeStr: string,
  typeMap: Map<string, { componentName: string; anchor: string }>,
): string {
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

  return result;
}

// Helper function to format interface properties
function formatInterfaceProperties(
  declaration: DeclarationReflection,
  typeMap: Map<string, { componentName: string; anchor: string }>,
): string {
  const children = declaration.children?.filter(
    (child) => child.kind === ReflectionKind.Property,
  );
  if (!children || children.length === 0) return "";

  let result = "\n#### Properties\n\n";
  for (const prop of children) {
    const name = prop.name;
    const typeStr = prop.type?.toString() || "unknown";
    const linkedType = formatTypeWithLinks(typeStr, typeMap);
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

function kebabCaseToCamelCase(name: string): string {
  return name.replace(/-[a-z]/g, (b) => b.slice(1).toUpperCase());
}

// Helper function to generate markdown documentation
function generateMarkdown(
  name: string,
  fileName: string,
  declarations: DeclarationReflection[],
  typeMap: Map<string, { componentName: string; anchor: string }>,
  isUtility = false,
): { description: string; markdown: string } {
  const docType = isUtility ? "utility" : "component";

  const camelCaseName = kebabCaseToCamelCase(name);

  let description = "";
  let moduleDescription = "";

  // Look for module-level documentation
  const moduleDecl = declarations.find((d) => d.kind === ReflectionKind.Module);
  if (moduleDecl?.comment) {
    moduleDescription = formatComment(moduleDecl.comment);
    if (moduleDescription) {
      let firstPart = moduleDescription.trim().indexOf("\n");
      if (firstPart === -1) {
        firstPart = moduleDescription.length;
      }
      description = moduleDescription.slice(0, firstPart).trim();
    }
  }

  if (!description) {
    description = `${name} ${docType} documentation`;
  }

  let markdown = `
---
title: ${camelCaseName}
description: ${JSON.stringify(description)}
sourceUrl: https://github.com/cfeenstra67/stackattack/blob/main/packages/aws/src/${fileName}
---

`.trimStart();

  if (moduleDescription) {
    markdown += `${moduleDescription}\n\n\n`;
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
      typeMap,
      isUtility,
      true,
    )}\n`;
    markdown += formatReturnType(mainFunction.signatures?.[0], typeMap);
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
    const heading = isUtility || !mainFunction ? "# Functions" : "## Functions";
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
        typeMap,
        isUtility,
        !!mainFunction,
      )}\n`;
      markdown += formatReturnType(func.signatures?.[0], typeMap);
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
      markdown += `${formatInterfaceProperties(iface, typeMap)}\n`;
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

  return { description, markdown };
}

async function generateDocs() {
  // Bootstrap the application
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [
      "../aws/src/components",
      "../aws/src/select.ts",
      "../aws/src/stack-ref.ts",
      "../aws/src/context.ts",
    ],
    entryPointStrategy: "expand",
    tsconfig: "../aws/tsconfig.esm.json",
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

  const conceptsOutputDir = "./src/content/docs/concepts";
  const componentsOutputDir = "./src/content/docs/components";
  const utilitiesOutputDir = "./src/content/docs/utilities";

  // Ensure output directories exist
  if (!fs.existsSync(componentsOutputDir)) {
    fs.mkdirSync(componentsOutputDir, { recursive: true });
  }
  if (!fs.existsSync(conceptsOutputDir)) {
    fs.mkdirSync(conceptsOutputDir, { recursive: true });
  }
  if (!fs.existsSync(utilitiesOutputDir)) {
    fs.mkdirSync(utilitiesOutputDir, { recursive: true });
  }

  // Process component and utility files
  const componentFiles = new Map<
    string,
    { fileName: string; declarations: DeclarationReflection[] }
  >();
  const utilityFiles = new Map<
    string,
    { fileName: string; declarations: DeclarationReflection[] }
  >();
  const conceptFiles = new Map<
    string,
    { fileName: string; declarations: DeclarationReflection[] }
  >();

  // Build a global map of all types/interfaces for cross-linking
  const typeMap = new Map<string, { componentName: string; anchor: string }>();

  // Utility file name mappings
  const utilityNameMap: Record<string, string> = {
    "stack-ref": "stack-ref",
    select: "select",
  };

  const conceptsNameMap: Record<string, string> = {
    context: "context",
  };

  // Group declarations by source file
  for (const child of project.children ?? []) {
    if (child.sources && child.sources.length > 0) {
      const sourceFile = child.sources[0].fileName;
      const fileMatch = sourceFile.match(/^(.+)\.ts$/);

      if (fileMatch) {
        const originalFileName = fileMatch[1];
        let fileName = originalFileName;

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
        const type = Object.hasOwn(utilityNameMap, fileName)
          ? "utility"
          : Object.hasOwn(conceptsNameMap, fileName)
            ? "concept"
            : "component";
        const targetMap =
          type === "utility"
            ? utilityFiles
            : type === "concept"
              ? conceptFiles
              : componentFiles;
        const targetName =
          type === "utility"
            ? utilityNameMap[fileName]
            : type === "concept"
              ? conceptsNameMap[fileName]
              : fileName;

        if (!targetMap.has(targetName)) {
          targetMap.set(targetName, {
            fileName: `${originalFileName}.ts`,
            declarations: [],
          });
        }

        const children = child.children?.sort((a, b) => {
          let aType = false;
          if (
            a.kind === ReflectionKind.Interface ||
            a.kind === ReflectionKind.TypeAlias
          ) {
            aType = true;
          }
          let bType = false;
          if (
            b.kind === ReflectionKind.Interface ||
            b.kind === ReflectionKind.TypeAlias
          ) {
            bType = true;
          }
          if (aType === bType) {
            return 0;
          }
          return aType ? 1 : -1;
        });

        // If this is a module, get its children (the actual exports)
        if (child.kind === ReflectionKind.Module && children) {
          // Store the module itself for potential @packageDocumentation comment
          const moduleDecl = child as DeclarationReflection;
          targetMap.get(targetName)!.declarations.push(moduleDecl);

          const anchorCounts: Record<string, number> = {};
          for (const decl of children) {
            targetMap.get(targetName)!.declarations.push(decl);

            const anchor = decl.name.toLowerCase();
            anchorCounts[anchor] ??= -1;
            anchorCounts[anchor]++;

            // Add to type map for cross-linking
            if (
              decl.kind === ReflectionKind.Interface ||
              decl.kind === ReflectionKind.TypeAlias
            ) {
              const linkPath =
                type === "utility"
                  ? `/utilities/${targetName}/`
                  : type === "concept"
                    ? `/concepts/${targetName}/`
                    : `/components/${targetName}/`;

              const ct = anchorCounts[anchor];
              const fullAnchor = ct === 0 ? anchor : `${anchor}-${ct}`;

              typeMap.set(decl.name, {
                componentName: linkPath,
                anchor: `#${fullAnchor}`,
              });
            }
          }
        } else {
          targetMap
            .get(targetName)!
            .declarations.push(child as DeclarationReflection);
        }
      }
    }
  }

  // Generate component documentation
  const componentDescriptions: Record<string, string> = {};
  for (const [componentName, { fileName, declarations }] of componentFiles) {
    const { markdown, description } = generateMarkdown(
      componentName,
      fileName,
      declarations,
      typeMap,
      false,
    );
    componentDescriptions[componentName] = description;
    const outputPath = path.join(componentsOutputDir, `${componentName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated documentation for ${componentName}`);
  }

  for (const [conceptName, { fileName, declarations }] of conceptFiles) {
    const { markdown } = generateMarkdown(
      conceptName,
      fileName,
      declarations,
      typeMap,
      false,
    );
    const outputPath = path.join(conceptsOutputDir, `${conceptName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated concept documentation for ${conceptName}`);
  }

  // Generate utility documentation
  for (const [utilityName, { fileName, declarations }] of utilityFiles) {
    const { markdown } = generateMarkdown(
      utilityName,
      fileName,
      declarations,
      typeMap,
      true,
    );
    const outputPath = path.join(utilitiesOutputDir, `${utilityName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated utility documentation for ${utilityName}`);
  }

  // Generate components index file
  const componentNames = Array.from(componentFiles.keys()).sort();
  const componentItems = componentNames.map((name) => {
    const description = componentDescriptions[name];
    const camelName = kebabCaseToCamelCase(name);
    return `- [${camelName}](/components/${name}/) - ${description}`;
  });

  const indexMarkdown = `---
title: Components
description: High-level, production-ready AWS components for Pulumi
---

Stackattack provides opinionated, secure-by-default AWS infrastructure components built on top of Pulumi.

## Getting Started

All components follow the same basic pattern:

\`\`\`typescript
import * as saws from "@stackattack/aws";

const ctx = saws.context();
const component = saws.componentName(ctx, { ... });
\`\`\`

See each component's documentation for information about arguments and usage.

## Available Components

${componentItems.join("\n")}
`;

  const indexPath = "./src/content/docs/components.md";
  fs.writeFileSync(indexPath, indexMarkdown);
  console.log("Generated components index file");

  console.log("Documentation generation complete!");
}

// Run the generation
generateDocs();
