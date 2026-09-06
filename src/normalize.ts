import type {
  JsonFaceDecl,
  JsonFaceDeclLike,
  JsonFaceFuncParam,
  JsonFaceFuncParamInput,
  JsonFaceProp,
  JsonFacePropInput,
  JsonFacePropLike,
  JsonFacePrimitiveName,
  JsonFaceTupleItem,
  JsonFaceTupleItemInput,
  JsonFaceTupleItemLike,
  JsonFaceType,
  JsonFaceTypeLike,
  JsonFaceTypeParam,
  JsonFaceTypeParamInput,
} from "./types.js";

export const primitiveNames = new Set<JsonFacePrimitiveName>([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "null",
  "undefined",
  "unknown",
  "any",
  "never",
  "void",
]);

export function isPrimitiveName(value: string): value is JsonFacePrimitiveName {
  return primitiveNames.has(value as JsonFacePrimitiveName);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeType(input: JsonFaceTypeLike): JsonFaceType {
  if (typeof input === "string") {
    if (input === "unknown") return { unknown: true };
    if (input === "any") return { any: true };
    if (input === "never") return { never: true };
    if (isPrimitiveName(input)) return { ref: input };
    return { ref: input };
  }

  if (!isObject(input)) {
    throw new Error(`Invalid JsonFace type: ${String(input)}`);
  }

  if ("ref" in input) return { ref: String(input.ref) };
  if ("literal" in input) return { literal: input.literal as any };
  if ("array" in input) return { array: normalizeType(input.array as JsonFaceTypeLike) };
  if ("tuple" in input) {
    return {
      tuple: (input.tuple as JsonFaceTupleItemLike[]).map(normalizeTupleItem),
    };
  }
  if ("object" in input) {
    return {
      object: Object.fromEntries(
        Object.entries(input.object as Record<string, JsonFacePropLike>).map(([key, value]) => [
          key,
          normalizeProp(value),
        ]),
      ),
    };
  }
  if ("union" in input) {
    return { union: (input.union as JsonFaceTypeLike[]).map(normalizeType) };
  }
  if ("intersection" in input) {
    return { intersection: (input.intersection as JsonFaceTypeLike[]).map(normalizeType) };
  }
  if ("record" in input) {
    const record = input.record as { key?: "string" | "number" | "symbol"; value: JsonFaceTypeLike };
    return {
      record: {
        key: record.key ?? "string",
        value: normalizeType(record.value),
      },
    };
  }
  if ("generic" in input) {
    const generic = input.generic as { base: JsonFaceTypeLike; args: JsonFaceTypeLike[] };
    return {
      generic: {
        base: normalizeType(generic.base),
        args: generic.args.map(normalizeType),
      },
    };
  }
  if ("conditional" in input) {
    const conditional = input.conditional as any;
    return {
      conditional: {
        check: normalizeType(conditional.check),
        extends: normalizeType(conditional.extends),
        true: normalizeType(conditional.true),
        false: normalizeType(conditional.false),
      },
    };
  }
  if ("unknown" in input) return { unknown: true };
  if ("any" in input) return { any: true };
  if ("never" in input) return { never: true };

  throw new Error(`Unknown JsonFace type object: ${JSON.stringify(input)}`);
}

export function normalizeProp(input: JsonFacePropLike): JsonFaceProp {
  if (typeof input === "string" || !isObject(input) || !("type" in input)) {
    return { type: normalizeType(input as JsonFaceTypeLike) };
  }
  const prop = input as JsonFacePropInput;
  return {
    ...prop,
    type: normalizeType(prop.type),
  };
}

export function normalizeTupleItem(input: JsonFaceTupleItemLike): JsonFaceTupleItem {
  if (typeof input === "string" || !isObject(input) || !("type" in input)) {
    return { type: normalizeType(input as JsonFaceTypeLike) };
  }
  const item = input as JsonFaceTupleItemInput;
  return {
    ...item,
    type: normalizeType(item.type),
  };
}

export function normalizeFuncParam(input: JsonFaceFuncParamInput): JsonFaceFuncParam {
  return {
    ...input,
    type: normalizeType(input.type),
  };
}

export function normalizeTypeParam(input: JsonFaceTypeParamInput): JsonFaceTypeParam {
  const normalized: JsonFaceTypeParam = { name: input.name };
  if (input.default != null) normalized.default = normalizeType(input.default);
  if (input.extends != null) normalized.extends = normalizeType(input.extends);
  return normalized;
}

export function normalizeDecl(input: JsonFaceDeclLike): JsonFaceDecl {
  if ("kind" in input) {
    if (input.kind === "interface") {
      return {
        kind: "interface",
        name: input.name,
        params: (input.params ?? []).map(normalizeTypeParam),
        props: Object.fromEntries(
          Object.entries(input.props).map(([key, value]) => [key, normalizeProp(value)]),
        ),
        desc: input.desc,
      };
    }
    if (input.kind === "type") {
      return {
        kind: "type",
        name: input.name,
        params: (input.params ?? []).map(normalizeTypeParam),
        type: normalizeType(input.type),
        desc: input.desc,
      };
    }
    return {
      kind: "func",
      name: input.name,
      params: (input.params ?? []).map(normalizeTypeParam),
      inputs: (input.inputs ?? []).map(normalizeFuncParam),
      output: normalizeType(input.output ?? "void"),
      desc: input.desc,
    };
  }

  if ("interface" in input) {
    return {
      kind: "interface",
      name: input.name,
      params: (input.params ?? []).map(normalizeTypeParam),
      props: Object.fromEntries(
        Object.entries(input.interface).map(([key, value]) => [key, normalizeProp(value)]),
      ),
      desc: input.desc,
    };
  }

  if ("type" in input) {
    return {
      kind: "type",
      name: input.name,
      params: (input.params ?? []).map(normalizeTypeParam),
      type: normalizeType(input.type),
      desc: input.desc,
    };
  }

  if ("funcsign" in input) {
    return {
      kind: "func",
      name: input.name,
      params: (input.params ?? []).map(normalizeTypeParam),
      inputs: (input.funcsign.inputs ?? []).map(normalizeFuncParam),
      output: normalizeType(input.funcsign.output ?? "void"),
      desc: input.desc,
    };
  }

  throw new Error(`Unknown JsonFace declaration: ${JSON.stringify(input)}`);
}
