export type JsonFacePrimitiveName =
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "symbol"
  | "null"
  | "undefined"
  | "unknown"
  | "any"
  | "never"
  | "void";

export type JsonFaceLiteralValue = string | number | boolean | null;

export type JsonFaceTypeLike =
  | JsonFacePrimitiveName
  | string
  | JsonFaceTypeInput;

export type JsonFacePropLike = JsonFaceTypeLike | JsonFacePropInput;

export interface JsonFacePropInput {
  type: JsonFaceTypeLike;
  optional?: boolean;
  readonly?: boolean;
  desc?: string;
}

export interface JsonFaceTupleItemInput {
  type: JsonFaceTypeLike;
  optional?: boolean;
  rest?: boolean;
  name?: string;
  desc?: string;
}

export interface JsonFaceFuncParamInput {
  name: string;
  type: JsonFaceTypeLike;
  optional?: boolean;
  rest?: boolean;
  desc?: string;
}

export interface JsonFaceTypeParamInput {
  name: string;
  default?: JsonFaceTypeLike;
  extends?: JsonFaceTypeLike;
}

export type JsonFaceTypeInput =
  | { ref: string }
  | { literal: JsonFaceLiteralValue }
  | { array: JsonFaceTypeLike }
  | { tuple: JsonFaceTupleItemLike[] }
  | { object: Record<string, JsonFacePropLike> }
  | { union: JsonFaceTypeLike[] }
  | { intersection: JsonFaceTypeLike[] }
  | { record: { key?: "string" | "number" | "symbol"; value: JsonFaceTypeLike } }
  | { generic: { base: JsonFaceTypeLike; args: JsonFaceTypeLike[] } }
  | { conditional: JsonFaceConditionalTypeInput }
  | { unknown: true }
  | { any: true }
  | { never: true };

export type JsonFaceTupleItemLike = JsonFaceTypeLike | JsonFaceTupleItemInput;

export interface JsonFaceConditionalTypeInput {
  check: JsonFaceTypeLike;
  extends: JsonFaceTypeLike;
  true: JsonFaceTypeLike;
  false: JsonFaceTypeLike;
}

export interface JsonFaceProp {
  type: JsonFaceType;
  optional?: boolean;
  readonly?: boolean;
  desc?: string;
}

export interface JsonFaceTupleItem {
  type: JsonFaceType;
  optional?: boolean;
  rest?: boolean;
  name?: string;
  desc?: string;
}

export interface JsonFaceFuncParam {
  name: string;
  type: JsonFaceType;
  optional?: boolean;
  rest?: boolean;
  desc?: string;
}

export interface JsonFaceTypeParam {
  name: string;
  default?: JsonFaceType;
  extends?: JsonFaceType;
}

export interface JsonFaceConditionalType {
  check: JsonFaceType;
  extends: JsonFaceType;
  true: JsonFaceType;
  false: JsonFaceType;
}

export type JsonFaceType =
  | { ref: string }
  | { literal: JsonFaceLiteralValue }
  | { array: JsonFaceType }
  | { tuple: JsonFaceTupleItem[] }
  | { object: Record<string, JsonFaceProp> }
  | { union: JsonFaceType[] }
  | { intersection: JsonFaceType[] }
  | { record: { key?: "string" | "number" | "symbol"; value: JsonFaceType } }
  | { generic: { base: JsonFaceType; args: JsonFaceType[] } }
  | { conditional: JsonFaceConditionalType }
  | { unknown: true }
  | { any: true }
  | { never: true };

export type JsonFaceDeclLike =
  | JsonFaceInterfaceDeclLike
  | JsonFaceTypeDeclLike
  | JsonFaceFuncDeclLike
  | JsonFaceKindDecl;

export interface JsonFaceInterfaceDeclLike {
  name: string;
  params?: JsonFaceTypeParamInput[];
  interface: Record<string, JsonFacePropLike>;
  desc?: string;
}

export interface JsonFaceTypeDeclLike {
  name: string;
  params?: JsonFaceTypeParamInput[];
  type: JsonFaceTypeLike;
  desc?: string;
}

export interface JsonFaceFuncDeclLike {
  name: string;
  params?: JsonFaceTypeParamInput[];
  funcsign: {
    inputs?: JsonFaceFuncParamInput[];
    output?: JsonFaceTypeLike;
  };
  desc?: string;
}

export type JsonFaceKindDecl =
  | {
    kind: "interface";
    name: string;
    params?: JsonFaceTypeParamInput[];
    props: Record<string, JsonFacePropLike>;
    desc?: string;
  }
  | {
    kind: "type";
    name: string;
    params?: JsonFaceTypeParamInput[];
    type: JsonFaceTypeLike;
    desc?: string;
  }
  | {
    kind: "func";
    name: string;
    params?: JsonFaceTypeParamInput[];
    inputs?: JsonFaceFuncParamInput[];
    output?: JsonFaceTypeLike;
    desc?: string;
  };

export type JsonFaceDecl =
  | {
    kind: "interface";
    name: string;
    params: JsonFaceTypeParam[];
    props: Record<string, JsonFaceProp>;
    desc?: string;
  }
  | {
    kind: "type";
    name: string;
    params: JsonFaceTypeParam[];
    type: JsonFaceType;
    desc?: string;
  }
  | {
    kind: "func";
    name: string;
    params: JsonFaceTypeParam[];
    inputs: JsonFaceFuncParam[];
    output: JsonFaceType;
    desc?: string;
  };

export interface CompileToZodOptions {
  registry?: JsonFaceRegistryLike;
  typeParams?: ReadonlySet<string>;
  objectUnknownKeys?: "strip" | "strict" | "passthrough";
}

export interface JsonFaceRegistryLike {
  get(name: string): JsonFaceDecl | undefined;
}
