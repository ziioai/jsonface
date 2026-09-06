
# @ziioai/jsonface

TypeScript-like declarations encoded as JSON, with TypeScript emission and
runtime Zod compilation where supported.

JSONFace is an intermediate representation rather than a JSON Schema dialect.

## Install

```sh
pnpm add @ziioai/jsonface
```

`@ziioai/jsonface` is ESM-only and supports Node.js 20 or newer.

## Quick start

```ts
import { JsonFaceRegistry, compileDeclToZod, emitDecl } from "@ziioai/jsonface";

const user = {
  name: "User",
  interface: {
    id: "number",
    name: { type: "string", optional: true },
  },
} as const;

console.log(emitDecl(user));

const registry = new JsonFaceRegistry([user]);
const schema = compileDeclToZod(registry.get("User")!, { registry });
schema.parse({ id: 1, name: "Ada" });
```

## Specification

See:

- [SPEC.md](./SPEC.md)
- [SPEC-CN.md](./SPEC-CN.md)

## License

MIT
