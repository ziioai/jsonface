# JSONFace Spec

JSONFace is a TS-like type and declaration IR encoded as JSON.

It is not a JSON Schema dialect. JSONFace describes TypeScript-shaped declarations that can be normalized, resolved, emitted as TypeScript, and compiled to runtime validators where possible.

## Goals

- Describe interfaces, type aliases, and function signatures in JSON.
- Keep the source format compact and pleasant to write by hand.
- Normalize all shorthand forms into a stable internal AST.
- Compile runtime-supported types to Zod.
- Emit TypeScript declarations.
- Leave advanced TypeScript-only forms, such as conditional types, available for code generation without pretending they have a direct runtime validator.

## Non-Goals For V1

- Full TypeScript type-system emulation.
- Full JSON Schema compatibility.
- Runtime evaluation of conditional types.
- Full generic instantiation and generic constraint solving.
- Mapped types, `keyof`, `infer`, template literal types, indexed access types.

## Two Layers

JSONFace has two layers:

- Source forms: user-facing, shorthand-friendly input.
- Normalized forms: internal AST returned by `normalizeType()` and `normalizeDecl()`.

Source examples:

```js
"string"
"User"
{ array: "string" }
{ name: "User", interface: { id: "number" } }
```

Normalized examples:

```js
{ ref: "string" }
{ ref: "User" }
{ array: { ref: "string" } }
{
  kind: "interface",
  name: "User",
  params: [],
  props: {
    id: { type: { ref: "number" } },
  },
}
```

Consumers should accept source forms at API boundaries and use normalized forms internally.

## Primitive Names

These names are reserved as primitive references:

```txt
string
number
boolean
bigint
symbol
null
undefined
unknown
any
never
void
```

A string type expression is normalized as `{ ref: value }`. If the value is a primitive name, downstream compilers treat it as a primitive. Otherwise, it is a named declaration reference.

```js
"string" // { ref: "string" }
"User"   // { ref: "User" }
```

## Declarations

JSONFace supports three declaration kinds.

### Interface Declaration

Source form:

```js
{
  name: "User",
  interface: {
    id: { type: "number", readonly: true },
    name: { type: "string", optional: true },
    tags: { type: { array: "string" } },
  },
}
```

Equivalent kind form:

```js
{
  kind: "interface",
  name: "User",
  props: {
    id: { type: "number", readonly: true },
    name: { type: "string", optional: true },
    tags: { type: { array: "string" } },
  },
}
```

Normalized:

```js
{
  kind: "interface",
  name: "User",
  params: [],
  props: {
    id: { type: { ref: "number" }, readonly: true },
    name: { type: { ref: "string" }, optional: true },
    tags: { type: { array: { ref: "string" } } },
  },
}
```

Interface properties may also use type expression shorthand:

```js
{
  name: "User",
  interface: {
    id: "number",
    tags: { array: "string" },
  },
}
```

### Type Alias Declaration

```js
{
  name: "Status",
  type: {
    union: [
      { literal: "active" },
      { literal: "inactive" },
    ],
  },
}
```

Kind form:

```js
{
  kind: "type",
  name: "Status",
  type: { union: [{ literal: "active" }, { literal: "inactive" }] },
}
```

### Function Signature Declaration

```js
{
  name: "GetUser",
  funcsign: {
    inputs: [
      { name: "id", type: "number" },
      { name: "raw", type: "boolean", optional: true },
    ],
    output: "User",
  },
}
```

Kind form:

```js
{
  kind: "func",
  name: "GetUser",
  inputs: [
    { name: "id", type: "number" },
  ],
  output: "User",
}
```

If `output` is omitted, it defaults to `void`.

## Type Parameters

Declarations may carry `params`.

```js
{
  name: "Response",
  params: [
    { name: "T" },
    { name: "E", default: "unknown" },
  ],
  interface: {
    data: "T",
    error: { type: "E", optional: true },
  },
}
```

Type parameters support:

- `name`: parameter name.
- `extends`: optional constraint type.
- `default`: optional default type.

They are emitted to TypeScript. Generic declarations are not directly compiled to Zod in v1.

## Property Forms

Interface and object properties accept shorthand type expressions or expanded property objects.

```js
{
  id: "number",
  name: { type: "string", optional: true },
  tags: { type: { array: "string" } },
}
```

Property fields:

- `type`: property type.
- `optional`: emits `?` in TypeScript and `.optional()` in Zod.
- `readonly`: emits `readonly` in TypeScript. It has no runtime Zod effect.
- `desc`: documentation metadata. It has no runtime effect in v1.

## Type Expressions

### Ref

```js
{ ref: "User" }
"User"
```

Refs point to primitives, type parameters, or registered declarations.

### Literal

```js
{ literal: "active" }
{ literal: 42 }
{ literal: true }
{ literal: null }
```

Supported literal values are `string | number | boolean | null`.

### Array

```js
{ array: "string" }
```

Emits as `string[]`.

### Tuple

```js
{
  tuple: [
    "number",
    "number",
    { type: "string", optional: true },
    { type: "boolean", rest: true },
  ],
}
```

Tuple item fields:

- `type`: item type.
- `optional`: optional tuple item.
- `rest`: rest tuple item.
- `name`: optional tuple label for TypeScript emit.
- `desc`: documentation metadata.

### Object

```js
{
  object: {
    id: "number",
    name: { type: "string", optional: true },
  },
}
```

Object property rules are the same as interface property rules.

### Union

```js
{ union: ["string", "number", { literal: null }] }
```

An empty union compiles to `z.never()`.

### Intersection

```js
{ intersection: ["A", "B"] }
```

An empty intersection compiles to `z.unknown()`.

### Record

```js
{ record: { value: "number" } }
{ record: { key: "string", value: "number" } }
```

`key` defaults to `"string"`.

Supported keys:

```txt
string
number
symbol
```

### Generic

```js
{ generic: { base: "Array", args: ["string"] } }
{ generic: { base: "Record", args: ["string", "number"] } }
```

V1 Zod compilation supports these runtime generic bases:

- `Array<T>`
- `Record<K, V>`

Other generic bases are kept in the AST and can be emitted to TypeScript, but `compileType()` throws for runtime compilation.

### Conditional

```js
{
  conditional: {
    check: "T",
    extends: "string",
    true: { literal: true },
    false: { literal: false },
  },
}
```

Conditional types are normalized and emitted to TypeScript.

They cannot be compiled to runtime Zod schemas in v1.

### Unknown, Any, Never

```js
{ unknown: true }
{ any: true }
{ never: true }
```

String shorthand also works:

```js
"unknown"
"any"
"never"
```

## Registry Semantics

`JsonFaceRegistry` stores normalized declarations by name.

Rules:

- Duplicate declaration names are rejected.
- `get(name)` returns the normalized declaration.
- `compileType()` resolves non-primitive refs through the provided registry.
- Missing refs throw an error.

Example:

```js
const registry = new JsonFaceRegistry([
  { name: "User", interface: { id: "number" } },
]);

const schema = compileDeclToZod(registry.get("User"), { registry });
```

## Zod Compilation Semantics

Runtime-supported forms compile as follows:

| JSONFace | Zod |
| --- | --- |
| `string` | `z.string()` |
| `number` | `z.number()` |
| `boolean` | `z.boolean()` |
| `bigint` | `z.bigint()` |
| `symbol` | `z.symbol()` |
| `null` | `z.null()` |
| `undefined`, `void` | `z.undefined()` |
| `unknown` | `z.unknown()` |
| `any` | `z.any()` |
| `never` | `z.never()` |
| `{ literal }` | `z.literal(...)` |
| `{ array }` | `z.array(...)` |
| `{ tuple }` | `z.tuple(...)` |
| `{ object }` / interface | `z.object(...)` |
| `{ union }` | `z.union(...)` |
| `{ intersection }` | `z.intersection(...)` |
| `{ record }` | `z.record(...)` |
| `Array<T>` generic | `z.array(...)` |
| `Record<K, V>` generic | `z.record(...)` |

Unsupported runtime forms throw descriptive errors instead of silently weakening validation.

## TypeScript Emit Semantics

`emitType()` and `emitDecl()` produce TypeScript declaration strings.

Examples:

```js
emitDecl({
  name: "User",
  interface: {
    id: { type: "number", readonly: true },
    name: { type: "string", optional: true },
  },
});
```

Output:

```ts
export interface User {
  readonly id: number;
  name?: string;
}
```

Function signature declarations emit as type aliases:

```ts
export type GetUser = (id: number, raw?: boolean) => User;
```

Conditional types emit as TypeScript conditional types:

```ts
export type IsString<T> = T extends string ? true : false;
```

## Stability Rules

- Source shorthand may grow over time.
- Normalized AST shape should remain stable within a major version.
- Runtime compilers should fail loudly for unsupported forms.
- Documentation metadata, such as `desc`, must not affect validation semantics.
- A compiler backend may support only a subset of JSONFace, but it should document that subset.
