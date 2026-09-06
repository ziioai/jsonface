import { normalizeDecl } from "./normalize.js";
import type { JsonFaceDecl, JsonFaceDeclLike } from "./types.js";

export class JsonFaceRegistry {
  private readonly decls = new Map<string, JsonFaceDecl>();

  constructor(decls: Iterable<JsonFaceDeclLike> = []) {
    this.addMany(decls);
  }

  add(input: JsonFaceDeclLike): this {
    const decl = normalizeDecl(input);
    if (this.decls.has(decl.name)) {
      throw new Error(`JsonFace declaration already exists: ${decl.name}`);
    }
    this.decls.set(decl.name, decl);
    return this;
  }

  addMany(inputs: Iterable<JsonFaceDeclLike>): this {
    for (const input of inputs) this.add(input);
    return this;
  }

  get(name: string): JsonFaceDecl | undefined {
    return this.decls.get(name);
  }

  has(name: string): boolean {
    return this.decls.has(name);
  }

  values(): JsonFaceDecl[] {
    return [...this.decls.values()];
  }
}
