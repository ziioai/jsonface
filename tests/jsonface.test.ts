import { describe, expect, test } from "vitest";
import {
  JsonFaceRegistry,
  compileDeclToZod,
  compileType,
  emitDecl,
  emitDeclarations,
  emitType,
  normalizeDecl,
  normalizeType,
} from "../src/index.js";

describe("jsonface normalize", () => {
  test("normalizes interface shorthand declarations", () => {
    const decl = normalizeDecl({
      name: "User",
      interface: {
        id: { type: "number", readonly: true },
        name: { type: "string", optional: true },
        tags: { type: { array: "string" } },
      },
    });

    expect(decl).toEqual({
      kind: "interface",
      name: "User",
      params: [],
      props: {
        id: { type: { ref: "number" }, readonly: true },
        name: { type: { ref: "string" }, optional: true },
        tags: { type: { array: { ref: "string" } } },
      },
    });
  });

  test("normalizes unions, tuples, generics, and conditional types", () => {
    expect(normalizeType({ union: ["string", "number", { literal: true }] })).toEqual({
      union: [{ ref: "string" }, { ref: "number" }, { literal: true }],
    });
    expect(normalizeType({ tuple: ["number", "number", { type: "string", optional: true }] })).toEqual({
      tuple: [
        { type: { ref: "number" } },
        { type: { ref: "number" } },
        { type: { ref: "string" }, optional: true },
      ],
    });
    expect(normalizeType({ generic: { base: "Array", args: ["string"] } })).toEqual({
      generic: { base: { ref: "Array" }, args: [{ ref: "string" }] },
    });
    expect(normalizeType({
      conditional: {
        check: "T",
        extends: "string",
        true: { literal: true },
        false: { literal: false },
      },
    })).toEqual({
      conditional: {
        check: { ref: "T" },
        extends: { ref: "string" },
        true: { literal: true },
        false: { literal: false },
      },
    });
  });
});

describe("jsonface zod compiler", () => {
  test("compiles interfaces, optional props, arrays, refs, and literal unions", () => {
    const registry = new JsonFaceRegistry([
      {
        name: "Status",
        type: { union: [{ literal: "active" }, { literal: "inactive" }] },
      },
      {
        name: "User",
        interface: {
          id: "number",
          name: { type: "string", optional: true },
          tags: { array: "string" },
          status: "Status",
        },
      },
    ]);
    const user = registry.get("User");
    expect(user).toBeDefined();

    const schema = compileDeclToZod(user!, { registry });
    expect(schema.parse({
      id: 1,
      tags: ["admin"],
      status: "active",
    })).toEqual({
      id: 1,
      tags: ["admin"],
      status: "active",
    });
    expect(() => schema.parse({
      id: "1",
      tags: ["admin"],
      status: "active",
    })).toThrow();
    expect(() => schema.parse({
      id: 1,
      tags: ["admin"],
      status: "pending",
    })).toThrow();
  });

  test("can reject unknown object keys in strict mode", () => {
    const registry = new JsonFaceRegistry([
      {
        name: "Profile",
        interface: {
          displayName: "string",
        },
      },
      {
        name: "User",
        interface: {
          id: "number",
          profile: "Profile",
        },
      },
    ]);

    const defaultSchema = compileDeclToZod(registry.get("User")!, { registry });
    expect(defaultSchema.parse({
      id: 1,
      profile: { displayName: "Ziion", unknownNested: true },
      unknownTop: true,
    })).toEqual({
      id: 1,
      profile: { displayName: "Ziion" },
    });

    const strictSchema = compileDeclToZod(registry.get("User")!, {
      registry,
      objectUnknownKeys: "strict",
    });
    expect(() => strictSchema.parse({
      id: 1,
      profile: { displayName: "Ziion" },
      unknownTop: true,
    })).toThrow();
    expect(() => strictSchema.parse({
      id: 1,
      profile: { displayName: "Ziion", unknownNested: true },
    })).toThrow();
  });

  test("compiles tuples, records, intersections, and Array generic shorthand", () => {
    expect(compileType({ tuple: ["number", "number", { type: "string", optional: true }] }).parse([1, 2])).toEqual([1, 2]);
    expect(compileType({ tuple: ["number", "number", { type: "string", optional: true }] }).parse([1, 2, "x"])).toEqual([1, 2, "x"]);
    expect(compileType({ tuple: ["number", { type: "string", rest: true }] }).parse([1, "a", "b"])).toEqual([1, "a", "b"]);
    expect(compileType({ record: { value: "number" } }).parse({ a: 1 })).toEqual({ a: 1 });
    expect(compileType({ generic: { base: "Array", args: ["string"] } }).parse(["a"])).toEqual(["a"]);
    expect(compileType({ generic: { base: "Record", args: ["string", "number"] } }).parse({ a: 1 })).toEqual({ a: 1 });

    const schema = compileType({
      intersection: [
        { object: { id: "number" } },
        { object: { name: "string" } },
      ],
    });
    expect(schema.parse({ id: 1, name: "Ziion" })).toEqual({ id: 1, name: "Ziion" });
  });

  test("reports unsupported runtime forms clearly", () => {
    expect(() => compileType("Missing", { registry: new JsonFaceRegistry() })).toThrow(/Unknown JsonFace ref/);
    expect(() => compileType({ generic: { base: "Promise", args: ["string"] } })).toThrow(/Unsupported generic/);

    const registry = new JsonFaceRegistry([
      { name: "Box", params: [{ name: "T" }], interface: { value: "T" } },
    ]);
    expect(() => compileDeclToZod(registry.get("Box")!, { registry })).toThrow(/generic declaration/);
  });

  test("does not compile conditional types to runtime zod", () => {
    expect(() => compileType({
      conditional: {
        check: "T",
        extends: "string",
        true: { literal: true },
        false: { literal: false },
      },
    })).toThrow(/conditional/);
  });
});

describe("jsonface registry", () => {
  test("stores normalized declarations and rejects duplicates", () => {
    const registry = new JsonFaceRegistry([{ name: "User", interface: { id: "number" } }]);
    expect(registry.has("User")).toBe(true);
    expect(registry.get("User")).toEqual({
      kind: "interface",
      name: "User",
      params: [],
      props: { id: { type: { ref: "number" } } },
    });
    expect(() => registry.add({ name: "User", type: "string" })).toThrow(/already exists/);
  });
});

describe("jsonface TypeScript emitter", () => {
  test("emits interface, type alias, function signature, and generic declaration", () => {
    expect(emitDecl({
      name: "User",
      interface: {
        id: { type: "number", readonly: true },
        name: { type: "string", optional: true },
        tags: { array: "string" },
      },
    })).toBe([
      "export interface User {",
      "  readonly id: number;",
      "  name?: string;",
      "  tags: string[];",
      "}",
    ].join("\n"));

    expect(emitDecl({
      name: "Status",
      type: { union: [{ literal: "active" }, { literal: "inactive" }] },
    })).toBe('export type Status = "active" | "inactive";');

    expect(emitDecl({
      name: "GetUser",
      funcsign: {
        inputs: [
          { name: "id", type: "number" },
          { name: "raw", type: "boolean", optional: true },
        ],
        output: "User",
      },
    })).toBe("export type GetUser = (id: number, raw?: boolean) => User;");

    expect(emitDecl({
      name: "Response",
      params: [{ name: "T" }],
      interface: { data: "T" },
    })).toBe([
      "export interface Response<T> {",
      "  data: T;",
      "}",
    ].join("\n"));
  });

  test("emits advanced type expressions", () => {
    expect(emitType({ generic: { base: "Array", args: ["string"] } })).toBe("Array<string>");
    expect(emitType({ object: { "bad-key": { type: "number", readonly: true } } })).toBe('{ readonly "bad-key": number; }');
    expect(emitType({
      conditional: {
        check: "T",
        extends: "string",
        true: { literal: true },
        false: { literal: false },
      },
    })).toBe("T extends string ? true : false");
    expect(emitDeclarations([
      { name: "A", type: { union: ["string", "number"] } },
      { name: "B", type: { intersection: ["C", "D"] } },
    ])).toBe([
      "export type A = string | number;",
      "",
      "export type B = C & D;",
    ].join("\n"));
  });

  test("emits type parameter constraints and defaults", () => {
    expect(emitDecl({
      name: "Response",
      params: [
        { name: "T", extends: { object: { id: "number" } } },
        { name: "E", default: "unknown" },
      ],
      type: { object: { data: "T", error: { type: "E", optional: true } } },
    })).toBe("export type Response<T extends { id: number; }, E = unknown> = { data: T; error?: E; };");
  });
});
