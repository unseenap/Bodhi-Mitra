import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : extname(path) === ".ts" ? [path] : [];
  }));
  return nested.flat();
}

describe("post-cutover backend", () => {
  it("contains no MongoDB runtime or fallback imports", async () => {
    const root = new URL("../src", import.meta.url);
    const files = await sourceFiles(root.pathname.replace(/^\/(.:)/, "$1"));
    const source = (await Promise.all(files.map(path => readFile(path, "utf8")))).join("\n");
    for (const forbidden of ["mongoose", "MONGODB_URI", "mysqlRuntime", "../models/"])
      expect(source).not.toContain(forbidden);
  });

  it("does not ship a MongoDB dependency or example variable", async () => {
    const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
    expect(packageJson).not.toContain("mongoose");
    expect(example).not.toContain("MONGODB_URI");
    expect(example).toContain("DATABASE_URL=");
  });
});
