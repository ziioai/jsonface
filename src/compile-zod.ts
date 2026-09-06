import { z } from "zod";
import { isPrimitiveName, normalizeType } from "./normalize.js";
import type { CompileToZodOptions, JsonFaceDecl, JsonFaceProp, JsonFaceType, JsonFaceTypeLike } from "./types.js";

export type JsonFaceZodSchema = z.ZodTypeAny;

function compilePrimitive(name: string): JsonFaceZodSchema {
  if (name === "string") return z.string();
  if (name === "number") return z.number();
  if (name === "boolean") return z.boolean();
  if (name === "bigint") return z.bigint();
  if (name === "symbol") return z.symbol();
  if (name === "null") return z.null();
  if (name === "undefined" || name === "void") return z.undefined();
  if (name === "unknown" || name === "any") return z.any();
  if (name === "never") return z.never();
  throw new Error(`Unknown primitive: ${name}`);
}

function compileProp(prop: JsonFaceProp, options: CompileToZodOptions): JsonFaceZodSchema {
  let schema = compileType(prop.type, options);
  if (prop.optional) schema = schema.optional();
  return schema;
}

function compileObject(
  props: Record<string, JsonFaceProp>,
  options: CompileToZodOptions,
): JsonFaceZodSchema {
  const schema = z.object(
    Object.fromEntries(
      Object.entries(props).map(([key, prop]) => [key, compileProp(prop, options)]),
    ),
  );
  if (options.objectUnknownKeys === "strict") return schema.strict();
  if (options.objectUnknownKeys === "passthrough") return schema.passthrough();
  return schema.strip();
}

function compileDecl(decl: JsonFaceDecl, options: CompileToZodOptions): JsonFaceZodSchema {
  if (decl.params.length > 0) {
    throw new Error(`Cannot compile generic declaration without instantiation: ${decl.name}`);
  }
  if (decl.kind === "interface") {
    return compileObject(decl.props, options);
  }
  if (decl.kind === "type") {
    return compileType(decl.type, options);
  }
  return z.function({
    input: decl.inputs.map((input) => compileProp(input, options)) as any,
    output: compileType(decl.output, options),
  });
}

function compileGeneric(type: Extract<JsonFaceType, { generic: unknown }>, options: CompileToZodOptions): JsonFaceZodSchema {
  const base = type.generic.base;
  if ("ref" in base && base.ref === "Array") {
    const [item] = type.generic.args;
    if (item == null) throw new Error("Array generic requires one argument");
    return z.array(compileType(item, options));
  }
  if ("ref" in base && base.ref === "Record") {
    const [, value] = type.generic.args;
    if (value == null) throw new Error("Record generic requires two arguments");
    return z.record(z.string(), compileType(value, options));
  }
  throw new Error(`Unsupported generic type: ${JSON.stringify(type.generic)}`);
}

function withTupleRest(schema: JsonFaceZodSchema, rest: JsonFaceZodSchema): JsonFaceZodSchema {
  return (schema as z.ZodTuple<any, null>).rest(rest);
}

export function compileType(input: JsonFaceTypeLike, options: CompileToZodOptions = {}): JsonFaceZodSchema {
  const type = normalizeType(input);

  if ("ref" in type) {
    if (isPrimitiveName(type.ref)) return compilePrimitive(type.ref);
    if (options.typeParams?.has(type.ref)) return z.any();
    const decl = options.registry?.get(type.ref);
    if (decl == null) throw new Error(`Unknown JsonFace ref: ${type.ref}`);
    return z.lazy(() => compileDecl(decl, options));
  }
  if ("literal" in type) return z.literal(type.literal as any);
  if ("array" in type) return z.array(compileType(type.array, options));
  if ("tuple" in type) {
    const items = type.tuple.filter((item) => !item.rest);
    const rest = type.tuple.find((item) => item.rest);
    let schema: JsonFaceZodSchema = z.tuple(items.map((item) => {
      const itemSchema = compileType(item.type, options);
      return item.optional ? itemSchema.optional() : itemSchema;
    }) as any);
    if (rest != null) schema = withTupleRest(schema, compileType(rest.type, options));
    return schema;
  }
  if ("object" in type) {
    return compileObject(type.object, options);
  }
  if ("union" in type) {
    if (type.union.length === 0) return z.never();
    if (type.union.length === 1) return compileType(type.union[0], options);
    return z.union(type.union.map((item) => compileType(item, options)) as any);
  }
  if ("intersection" in type) {
    if (type.intersection.length === 0) return z.unknown();
    return type.intersection
      .map((item) => compileType(item, options))
      .reduce((left, right) => z.intersection(left, right));
  }
  if ("record" in type) {
    const keySchema = type.record.key === "number" ? z.number() : type.record.key === "symbol" ? z.symbol() : z.string();
    return z.record(keySchema as any, compileType(type.record.value, options));
  }
  if ("generic" in type) return compileGeneric(type, options);
  if ("conditional" in type) {
    throw new Error("JsonFace conditional types cannot be compiled to runtime Zod schemas");
  }
  if ("unknown" in type) return z.unknown();
  if ("any" in type) return z.any();
  if ("never" in type) return z.never();

  throw new Error(`Unsupported JsonFace type: ${JSON.stringify(type)}`);
}

export function compileDeclToZod(decl: JsonFaceDecl, options: CompileToZodOptions = {}): JsonFaceZodSchema {
  return compileDecl(decl, options);
}
