import { isPrimitiveName, normalizeDecl, normalizeType } from "./normalize.js";
import type {
  JsonFaceDecl,
  JsonFaceDeclLike,
  JsonFaceFuncParam,
  JsonFaceProp,
  JsonFaceType,
  JsonFaceTypeLike,
  JsonFaceTypeParam,
} from "./types.js";

function emitTypeParams(params: JsonFaceTypeParam[]): string {
  if (params.length === 0) return "";
  return `<${params.map((param) => {
    const parts = [param.name];
    if (param.extends != null) parts.push(`extends ${emitType(param.extends)}`);
    if (param.default != null) parts.push(`= ${emitType(param.default)}`);
    return parts.join(" ");
  }).join(", ")}>`;
}

function emitProperty(name: string, prop: JsonFaceProp): string {
  const readonly = prop.readonly ? "readonly " : "";
  const optional = prop.optional ? "?" : "";
  return `${readonly}${quotePropertyName(name)}${optional}: ${emitType(prop.type)};`;
}

function quotePropertyName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function emitFuncParam(param: JsonFaceFuncParam): string {
  const rest = param.rest ? "..." : "";
  const optional = param.optional && !param.rest ? "?" : "";
  const type = param.rest ? `${emitType(param.type)}[]` : emitType(param.type);
  return `${rest}${quotePropertyName(param.name)}${optional}: ${type}`;
}

export function emitType(input: JsonFaceTypeLike): string {
  const type = normalizeType(input);

  if ("ref" in type) {
    if (isPrimitiveName(type.ref)) return type.ref;
    return type.ref;
  }
  if ("literal" in type) return JSON.stringify(type.literal);
  if ("array" in type) return `${wrapArrayItem(type.array)}[]`;
  if ("tuple" in type) {
    return `[${type.tuple.map((item) => {
      const rest = item.rest ? "..." : "";
      const optional = item.optional ? "?" : "";
      const label = item.name ? `${item.name}${optional}: ` : "";
      const itemType = item.rest ? `${emitType(item.type)}[]` : emitType(item.type);
      return `${rest}${label}${itemType}`;
    }).join(", ")}]`;
  }
  if ("object" in type) {
    return `{ ${Object.entries(type.object).map(([name, prop]) => emitProperty(name, prop)).join(" ")} }`;
  }
  if ("union" in type) return type.union.map(emitUnionItem).join(" | ");
  if ("intersection" in type) return type.intersection.map(emitIntersectionItem).join(" & ");
  if ("record" in type) return `Record<${type.record.key ?? "string"}, ${emitType(type.record.value)}>`;
  if ("generic" in type) {
    return `${emitType(type.generic.base)}<${type.generic.args.map(emitType).join(", ")}>`;
  }
  if ("conditional" in type) {
    return `${emitType(type.conditional.check)} extends ${emitType(type.conditional.extends)} ? ${emitType(type.conditional.true)} : ${emitType(type.conditional.false)}`;
  }
  if ("unknown" in type) return "unknown";
  if ("any" in type) return "any";
  if ("never" in type) return "never";

  throw new Error(`Unsupported JsonFace type: ${JSON.stringify(type)}`);
}

function wrapArrayItem(type: JsonFaceType): string {
  if ("union" in type || "intersection" in type || "conditional" in type) return `(${emitType(type)})`;
  return emitType(type);
}

function emitUnionItem(type: JsonFaceType): string {
  if ("intersection" in type || "conditional" in type) return `(${emitType(type)})`;
  return emitType(type);
}

function emitIntersectionItem(type: JsonFaceType): string {
  if ("union" in type || "conditional" in type) return `(${emitType(type)})`;
  return emitType(type);
}

export function emitDecl(input: JsonFaceDeclLike | JsonFaceDecl): string {
  const decl = "kind" in input && "params" in input && Array.isArray(input.params)
    ? input as JsonFaceDecl
    : normalizeDecl(input as JsonFaceDeclLike);
  const params = emitTypeParams(decl.params);

  if (decl.kind === "interface") {
    const props = Object.entries(decl.props).map(([name, prop]) => `  ${emitProperty(name, prop)}`).join("\n");
    return `export interface ${decl.name}${params} {\n${props}\n}`;
  }
  if (decl.kind === "type") {
    return `export type ${decl.name}${params} = ${emitType(decl.type)};`;
  }
  return `export type ${decl.name}${params} = (${decl.inputs.map(emitFuncParam).join(", ")}) => ${emitType(decl.output)};`;
}

export function emitDeclarations(inputs: Iterable<JsonFaceDeclLike | JsonFaceDecl>): string {
  return [...inputs].map(emitDecl).join("\n\n");
}
