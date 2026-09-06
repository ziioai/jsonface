# JSONFace 规范

JSONFace 是一种用 JSON 表达的、类似 TypeScript 的类型与声明中间表示。

它不是 JSON Schema 的方言。JSONFace 描述的是 TypeScript 形态的声明：这些声明可以被规范化、解析引用、输出为 TypeScript，并且在可行时编译成运行时校验器。

## 目标

- 用 JSON 描述 interface、type alias 和函数签名。
- 让源格式保持紧凑，适合手写。
- 将所有简写形式规范化为稳定的内部 AST。
- 将运行时可支持的类型编译为 Zod。
- 输出 TypeScript declaration。
- 保留 conditional type 这类 TypeScript-only 高级类型，用于代码生成，但不假装它们天然拥有直接对应的运行时校验器。

## V1 非目标

- 完整模拟 TypeScript 类型系统。
- 完整兼容 JSON Schema。
- 在运行时求值 conditional type。
- 完整支持泛型实例化与泛型约束求解。
- 支持 mapped type、`keyof`、`infer`、template literal type、indexed access type。

## 两层结构

JSONFace 分为两层：

- 源格式：面向使用者，允许简写，适合手写。
- 规范化格式：由 `normalizeType()` 和 `normalizeDecl()` 返回的内部 AST。

源格式示例：

```js
"string"
"User"
{ array: "string" }
{ name: "User", interface: { id: "number" } }
```

规范化格式示例：

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

调用方应该在 API 边界接受源格式，在内部使用规范化格式。

## 原始类型名称

以下名称保留为 primitive reference：

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

字符串类型表达式会被规范化为 `{ ref: value }`。如果 value 是 primitive name，下游编译器将它视为原始类型；否则将它视为具名声明引用。

```js
"string" // { ref: "string" }
"User"   // { ref: "User" }
```

## 声明

JSONFace 支持三类声明。

### Interface 声明

源格式：

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

等价的 kind 形式：

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

规范化结果：

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

Interface 属性也可以使用类型表达式简写，例如：

```js
{
  name: "User",
  interface: {
    id: "number",
    tags: { array: "string" },
  },
}
```

### Type Alias 声明

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

Kind 形式：

```js
{
  kind: "type",
  name: "Status",
  type: { union: [{ literal: "active" }, { literal: "inactive" }] },
}
```

### 函数签名声明

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

Kind 形式：

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

如果省略 `output`，默认值为 `void`。

## 类型参数

声明可以携带 `params`。

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

类型参数支持：

- `name`：参数名。
- `extends`：可选约束类型。
- `default`：可选默认类型。

类型参数会被输出到 TypeScript。V1 中，泛型声明不能直接编译为 Zod。

## 属性形式

Interface 和 object 的属性可以使用简写类型表达式，也可以使用展开的属性对象。

```js
{
  id: "number",
  name: { type: "string", optional: true },
  tags: { type: { array: "string" } },
}
```

属性字段：

- `type`：属性类型。
- `optional`：在 TypeScript 中输出 `?`，在 Zod 中输出 `.optional()`。
- `readonly`：在 TypeScript 中输出 `readonly`。它对 Zod 运行时校验没有影响。
- `desc`：文档元数据。V1 中没有运行时影响。

## 类型表达式

### Ref

```js
{ ref: "User" }
"User"
```

Ref 可以指向 primitive、类型参数或已注册声明。

### Literal

```js
{ literal: "active" }
{ literal: 42 }
{ literal: true }
{ literal: null }
```

支持的 literal 值为 `string | number | boolean | null`。

### Array

```js
{ array: "string" }
```

输出为 `string[]`。

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

Tuple item 字段：

- `type`：成员类型。
- `optional`：可选 tuple 成员。
- `rest`：rest tuple 成员。
- `name`：可选 tuple label，用于 TypeScript 输出。
- `desc`：文档元数据。

### Object

```js
{
  object: {
    id: "number",
    name: { type: "string", optional: true },
  },
}
```

Object 的属性规则与 interface 的属性规则相同。

### Union

```js
{ union: ["string", "number", { literal: null }] }
```

空 union 会编译为 `z.never()`。

### Intersection

```js
{ intersection: ["A", "B"] }
```

空 intersection 会编译为 `z.unknown()`。

### Record

```js
{ record: { value: "number" } }
{ record: { key: "string", value: "number" } }
```

`key` 默认是 `"string"`。

支持的 key：

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

V1 的 Zod 编译支持以下运行时泛型基类：

- `Array<T>`
- `Record<K, V>`

其他泛型基类会保留在 AST 中，也可以输出为 TypeScript；但如果调用 `compileType()` 进行运行时编译，会抛出错误。

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

Conditional type 可以被规范化，也可以输出为 TypeScript。

V1 中，它不能编译为运行时 Zod schema。

### Unknown、Any、Never

```js
{ unknown: true }
{ any: true }
{ never: true }
```

也可以使用字符串简写：

```js
"unknown"
"any"
"never"
```

## Registry 语义

`JsonFaceRegistry` 按名称存储规范化后的声明。

规则：

- 拒绝重复声明名。
- `get(name)` 返回规范化声明。
- `compileType()` 通过传入的 registry 解析非 primitive ref。
- 缺失 ref 会抛出错误。

示例：

```js
const registry = new JsonFaceRegistry([
  { name: "User", interface: { id: "number" } },
]);

const schema = compileDeclToZod(registry.get("User"), { registry });
```

## Zod 编译语义

运行时支持的形式按下表编译：

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

不支持运行时编译的形式会抛出清晰错误，而不是悄悄放宽校验。

## TypeScript 输出语义

`emitType()` 和 `emitDecl()` 生成 TypeScript declaration 字符串。

示例：

```js
emitDecl({
  name: "User",
  interface: {
    id: { type: "number", readonly: true },
    name: { type: "string", optional: true },
  },
});
```

输出：

```ts
export interface User {
  readonly id: number;
  name?: string;
}
```

函数签名声明会输出为 type alias：

```ts
export type GetUser = (id: number, raw?: boolean) => User;
```

Conditional type 会输出为 TypeScript conditional type：

```ts
export type IsString<T> = T extends string ? true : false;
```

## 稳定性规则

- 源格式简写可以随时间扩展。
- 规范化 AST 的形态在一个 major version 内应该保持稳定。
- Runtime compiler 对不支持的形式应该明确失败。
- `desc` 等文档元数据不得影响校验语义。
- 某个编译后端可以只支持 JSONFace 的一个子集，但必须说明这个子集。
