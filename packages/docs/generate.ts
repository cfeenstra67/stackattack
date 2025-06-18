import * as fs from "node:fs";
import * as path from "node:path";
import { Application, ProjectReflection, ReflectionKind, DeclarationReflection, SignatureReflection, ParameterReflection, TypeParameterReflection, TSConfigReader, TypeDocReader } from "typedoc";

async function generateDocs() {
  // Bootstrap the application
  const app = await Application.bootstrapWithPlugins({
    entryPoints: ["../aws/src/components"],
    entryPointStrategy: "expand",
    tsconfig: "../aws/tsconfig.json",
    excludeExternals: true,
    excludePrivate: false,
    excludeProtected: false,
  });

  // Generate documentation
  const project = await app.convert();
  if (!project) {
    throw new Error("Failed to convert project");
  }
  

  const outputDir = "./src/content/docs/components";

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Helper function to format TypeDoc comments
  function formatComment(comment?: any): string {
    if (!comment) return "";
    
    let text = "";
    if (comment.summary) {
      text += comment.summary.map((part: any) => part.text || "").join("");
    }
    return text.trim();
  }

  // Helper function to format parameter documentation
  function formatParameters(parameters?: ParameterReflection[]): string {
    if (!parameters || parameters.length === 0) return "";
    
    let result = "\n### Parameters\n\n";
    for (const param of parameters) {
      const name = param.name;
      const typeStr = param.type?.toString() || "unknown";
      const linkedType = formatTypeWithLinks(typeStr);
      const description = formatComment(param.comment);
      const optional = param.flags.isOptional ? "?" : "";
      
      result += `- **\`${name}${optional}\`** (\`${linkedType}\`) - ${description}\n`;
    }
    return result;
  }

  // Helper function to format interface properties
  function formatInterfaceProperties(declaration: DeclarationReflection): string {
    const children = declaration.children?.filter(child => child.kind === ReflectionKind.Property);
    if (!children || children.length === 0) return "";
    
    let result = "\n### Properties\n\n";
    for (const prop of children) {
      const name = prop.name;
      const typeStr = prop.type?.toString() || "unknown";
      const linkedType = formatTypeWithLinks(typeStr);
      const description = formatComment(prop.comment);
      const optional = prop.flags.isOptional ? "?" : "";
      
      result += `- **\`${name}${optional}\`** (\`${linkedType}\`) - ${description}\n`;
    }
    return result;
  }

  // Helper function to convert types to links where possible
  function formatTypeWithLinks(typeStr: string): string {
    // Simple heuristic: replace known type names with links
    let result = typeStr;
    for (const [typeName, typeInfo] of typeMap) {
      // Use word boundaries to avoid replacing partial matches
      const regex = new RegExp(`\\b${typeName}\\b`, 'g');
      result = result.replace(regex, `[${typeName}](/components/${typeInfo.componentName}${typeInfo.anchor})`);
    }
    
    // Handle Context type (from context.ts, not in components)
    result = result.replace(/\bContext\b/g, '[Context](/concepts/context/)');
    
    return result;
  }

  // Helper function to format function signature
  function formatFunctionSignature(declaration: DeclarationReflection): string {
    const signatures = declaration.signatures;
    if (!signatures || signatures.length === 0) return "";
    
    const signature = signatures[0];
    const params = signature.parameters?.map(p => {
      const optional = p.flags.isOptional ? "?" : "";
      const typeStr = p.type?.toString() || "unknown";
      // Don't add links in code blocks - keep original types
      return `${p.name}${optional}: ${typeStr}`;
    }).join(", ") || "";
    
    const returnType = signature.type?.toString() || "void";
    // Don't add links in code blocks - keep original types
    
    return `\`\`\`typescript\nfunction ${declaration.name}(${params}): ${returnType}\n\`\`\``;
  }

  // Process each component file
  const componentFiles = new Map<string, DeclarationReflection[]>();
  
  // Build a global map of all types/interfaces for cross-linking
  const typeMap = new Map<string, { componentName: string; anchor: string }>();

  // Group declarations by source file
  project.children?.forEach(child => {
    if (child.sources && child.sources.length > 0) {
      const sourceFile = child.sources[0].fileName;
      // Since we're only looking at components directory, just extract the basename
      const componentMatch = sourceFile.match(/^(.+)\.ts$/);
      
      if (componentMatch) {
        const componentName = componentMatch[1];
        
        if (!componentFiles.has(componentName)) {
          componentFiles.set(componentName, []);
        }
        
        // If this is a module, get its children (the actual exports)
        if (child.kind === ReflectionKind.Module && child.children) {
          // Store the module itself for potential @packageDocumentation comment
          const moduleDecl = child as DeclarationReflection;
          componentFiles.get(componentName)!.push(moduleDecl);
          
          child.children.forEach((exportChild: any) => {
            const decl = exportChild as DeclarationReflection;
            componentFiles.get(componentName)!.push(decl);
            
            // Add to type map for cross-linking
            if (decl.kind === ReflectionKind.Interface || decl.kind === ReflectionKind.TypeAlias) {
              typeMap.set(decl.name, { 
                componentName, 
                anchor: `#${decl.name.toLowerCase()}` 
              });
            }
          });
        } else {
          componentFiles.get(componentName)!.push(child as DeclarationReflection);
        }
      }
    }
  });

  // Generate markdown for each component
  for (const [componentName, declarations] of componentFiles) {
    
    let markdown = `---\ntitle: ${componentName}\ndescription: ${componentName} component documentation\n---\n\n`;
    
    // Look for module-level documentation
    const moduleDecl = declarations.find(d => d.kind === ReflectionKind.Module);
    if (moduleDecl && moduleDecl.comment) {
      const moduleDescription = formatComment(moduleDecl.comment);
      if (moduleDescription) {
        markdown += moduleDescription + "\n\n";
      }
    }
    
    // Filter out module declaration for other processing
    const nonModuleDeclarations = declarations.filter(d => d.kind !== ReflectionKind.Module);
    
    // Find the main component function (usually matches the file name or is the primary export)
    const mainFunction = nonModuleDeclarations.find(d => 
      d.name === componentName || 
      d.name === componentName.replace(/-/g, "") ||
      (d.kind === ReflectionKind.Function && d.name.toLowerCase().includes(componentName.toLowerCase()))
    );
    
    if (mainFunction && mainFunction.kind === ReflectionKind.Function) {
      markdown += `# ${mainFunction.name}\n\n`;
      // Try to get comment from signature if not on function itself
      const comment = mainFunction.comment || mainFunction.signatures?.[0]?.comment;
      const description = formatComment(comment);
      if (description) {
        markdown += description + "\n\n";
      }
      markdown += formatFunctionSignature(mainFunction) + "\n";
      markdown += formatParameters(mainFunction.signatures?.[0]?.parameters) + "\n";
    }
    
    // Group remaining declarations by type
    const interfaces = nonModuleDeclarations.filter(d => d.kind === ReflectionKind.Interface && d !== mainFunction);
    const functions = nonModuleDeclarations.filter(d => d.kind === ReflectionKind.Function && d !== mainFunction);
    const types = nonModuleDeclarations.filter(d => d.kind === ReflectionKind.TypeAlias);
    
    // Document interfaces
    if (interfaces.length > 0) {
      markdown += "## Interfaces\n\n";
      for (const iface of interfaces) {
        markdown += `### ${iface.name}\n\n`;
        const ifaceDescription = formatComment(iface.comment);
        if (ifaceDescription) {
          markdown += ifaceDescription + "\n\n";
        }
        markdown += formatInterfaceProperties(iface) + "\n";
      }
    }
    
    // Document additional functions
    if (functions.length > 0) {
      markdown += "## Functions\n\n";
      for (const func of functions) {
        markdown += `### ${func.name}\n\n`;
        // Try to get comment from signature if not on function itself
        const comment = func.comment || func.signatures?.[0]?.comment;
        const funcDescription = formatComment(comment);
        if (funcDescription) {
          markdown += funcDescription + "\n\n";
        }
        markdown += formatFunctionSignature(func) + "\n";
        markdown += formatParameters(func.signatures?.[0]?.parameters) + "\n";
      }
    }
    
    // Document types
    if (types.length > 0) {
      markdown += "## Types\n\n";
      for (const type of types) {
        markdown += `### ${type.name}\n\n`;
        const typeDescription = formatComment(type.comment);
        if (typeDescription) {
          markdown += typeDescription + "\n\n";
        }
        markdown += `\`\`\`typescript\ntype ${type.name} = ${type.type?.toString() || "unknown"}\n\`\`\`\n\n`;
      }
    }
    
    // Write the markdown file
    const outputPath = path.join(outputDir, `${componentName}.md`);
    fs.writeFileSync(outputPath, markdown);
    console.log(`Generated documentation for ${componentName}`);
  }

  console.log("Documentation generation complete!");
}

// Run the generation
generateDocs().catch(console.error);