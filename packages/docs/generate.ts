import * as fs from "node:fs";
import * as path from "node:path";
import { Application, ProjectReflection, ReflectionKind, DeclarationReflection, SignatureReflection, ParameterReflection, TypeParameterReflection, TSConfigReader, TypeDocReader } from "typedoc";

async function generateDocs() {
  // Bootstrap the application
  const app = await Application.bootstrapWithPlugins({
    entryPoints: ["../aws/src/components"],
    entryPointStrategy: "expand",
    tsconfig: "../aws/tsconfig.json",
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
      const type = param.type?.toString() || "unknown";
      const description = formatComment(param.comment);
      const optional = param.flags.isOptional ? "?" : "";
      
      result += `- **\`${name}${optional}\`** (\`${type}\`) - ${description}\n`;
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
      const type = prop.type?.toString() || "unknown";
      const description = formatComment(prop.comment);
      const optional = prop.flags.isOptional ? "?" : "";
      
      result += `- **\`${name}${optional}\`** (\`${type}\`) - ${description}\n`;
    }
    return result;
  }

  // Helper function to format function signature
  function formatFunctionSignature(declaration: DeclarationReflection): string {
    const signatures = declaration.signatures;
    if (!signatures || signatures.length === 0) return "";
    
    const signature = signatures[0];
    const params = signature.parameters?.map(p => {
      const optional = p.flags.isOptional ? "?" : "";
      return `${p.name}${optional}: ${p.type?.toString() || "unknown"}`;
    }).join(", ") || "";
    
    const returnType = signature.type?.toString() || "void";
    
    return `\`\`\`typescript\nfunction ${declaration.name}(${params}): ${returnType}\n\`\`\``;
  }

  // Process each component file
  const componentFiles = new Map<string, DeclarationReflection[]>();

  // Group declarations by source file
  project.children?.forEach(child => {
    if (child.sources && child.sources.length > 0) {
      const sourceFile = child.sources[0].fileName;
      const componentMatch = sourceFile.match(/components\/([^\/]+)\.ts$/);
      
      if (componentMatch) {
        const componentName = componentMatch[1];
        
        if (!componentFiles.has(componentName)) {
          componentFiles.set(componentName, []);
        }
        
        // If this is a module, get its children (the actual exports)
        if (child.kind === ReflectionKind.Module && child.children) {
          child.children.forEach((exportChild: any) => {
            componentFiles.get(componentName)!.push(exportChild as DeclarationReflection);
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
    
    // Find the main component function (usually matches the file name or is the primary export)
    const mainFunction = declarations.find(d => 
      d.name === componentName || 
      d.name === componentName.replace(/-/g, "") ||
      (d.kind === ReflectionKind.Function && d.name.toLowerCase().includes(componentName.toLowerCase()))
    );
    
    if (mainFunction && mainFunction.kind === ReflectionKind.Function) {
      markdown += `# ${mainFunction.name}\n\n`;
      const description = formatComment(mainFunction.comment);
      if (description) {
        markdown += description + "\n\n";
      }
      markdown += formatFunctionSignature(mainFunction) + "\n";
      markdown += formatParameters(mainFunction.signatures?.[0]?.parameters) + "\n";
    }
    
    // Group remaining declarations by type
    const interfaces = declarations.filter(d => d.kind === ReflectionKind.Interface && d !== mainFunction);
    const functions = declarations.filter(d => d.kind === ReflectionKind.Function && d !== mainFunction);
    const types = declarations.filter(d => d.kind === ReflectionKind.TypeAlias);
    
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
        const funcDescription = formatComment(func.comment);
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