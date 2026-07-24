import { describe, expect, it } from "vitest";
import {
  buildResult,
  createContext,
  deepEqual,
  diffValues,
  joinPath,
  sharedUniqueKey,
  type CompareOptions,
  type DiffEntry,
} from "../../src/compare/diff.js";

function diff(proc: unknown, sys: unknown, options?: CompareOptions): DiffEntry[] {
  const ctx = createContext(options);
  diffValues(proc, sys, "", ctx);
  return ctx.entries;
}

describe("deepEqual", () => {
  it("compares primitives, arrays and objects structurally", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("treats undefined-valued keys as absent", () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: null })).toBe(false);
  });
});

describe("joinPath", () => {
  it("joins with dots and bracket-quotes dotted segments", () => {
    expect(joinPath("", "outputs")).toBe("outputs");
    expect(joinPath("outputs", "temp")).toBe("outputs.temp");
    expect(joinPath("outputs", "a.b")).toBe('outputs["a.b"]');
    expect(joinPath("", "a.b")).toBe('["a.b"]');
  });
});

describe("sharedUniqueKey", () => {
  it("picks the first candidate unique on both sides", () => {
    expect(sharedUniqueKey([{ name: "a" }], [{ name: "b" }])).toBe("name");
    expect(sharedUniqueKey([{ definition: "d1", label: "l" }], [{ definition: "d2", label: "l" }])).toBe("definition");
    expect(sharedUniqueKey([{ label: "l1" }], [{ label: "l2" }])).toBe("label");
  });

  it("rejects duplicate, missing or non-string keys", () => {
    expect(sharedUniqueKey([{ name: "a" }, { name: "a" }], [{ name: "a" }])).toBeUndefined();
    expect(sharedUniqueKey([{ name: "a" }, {}], [{ name: "a" }])).toBeUndefined();
    expect(sharedUniqueKey([1, 2], [3])).toBeUndefined();
  });
});

describe("diffValues", () => {
  it("reports overridden primitives", () => {
    expect(diff({ a: 1 }, { a: 2 })).toEqual([
      { path: "a", status: "overridden", procedureValue: 1, systemValue: 2 },
    ]);
  });

  it("reports added and removed keys as single whole-subtree entries", () => {
    const entries = diff({ gone: { deep: { x: 1 } } }, { fresh: [1, 2] });
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ path: "gone", status: "removed", procedureValue: { deep: { x: 1 } } });
    expect(entries).toContainEqual({ path: "fresh", status: "added", systemValue: [1, 2] });
  });

  it("treats undefined-valued keys as absent and null as a real value", () => {
    expect(diff({ a: undefined }, {})).toEqual([]);
    expect(diff({ a: null }, {})).toEqual([{ path: "a", status: "removed", procedureValue: null }]);
    expect(diff({ a: null }, { a: null })).toEqual([]);
    expect(diff({ a: null }, { a: 1 })).toEqual([
      { path: "a", status: "overridden", procedureValue: null, systemValue: 1 },
    ]);
  });

  it("emits a single entry on type-discriminator mismatch without recursing", () => {
    const proc = { out: { type: "ObservableProperty", definition: "def:temp" } };
    const sys = { out: { type: "Quantity", definition: "def:temp", uom: { code: "Cel" } } };
    expect(diff(proc, sys)).toEqual([
      { path: "out", status: "overridden", procedureValue: proc.out, systemValue: sys.out },
    ]);
  });

  it("emits a single entry on JS-kind mismatch", () => {
    expect(diff({ a: [1] }, { a: { b: 1 } })).toEqual([
      { path: "a", status: "overridden", procedureValue: [1], systemValue: { b: 1 } },
    ]);
  });

  it("recurses into nested objects building dotted paths", () => {
    expect(diff({ uom: { code: "K" } }, { uom: { code: "Cel" } })).toEqual([
      { path: "uom.code", status: "overridden", procedureValue: "K", systemValue: "Cel" },
    ]);
  });

  it("matches keyed arrays by name and recurses per pair", () => {
    const proc = [
      { name: "temp", type: "Quantity", uom: { code: "K" } },
      { name: "rate", type: "Quantity", uom: { code: "Hz" } },
    ];
    const sys = [
      { name: "temp", type: "Quantity", uom: { code: "Cel" } },
      { name: "humidity", type: "Quantity", uom: { code: "%" } },
    ];
    const entries = diff({ outputs: proc }, { outputs: sys });
    expect(entries).toContainEqual({
      path: "outputs.temp.uom.code",
      status: "overridden",
      procedureValue: "K",
      systemValue: "Cel",
    });
    expect(entries).toContainEqual({ path: "outputs.rate", status: "removed", procedureValue: proc[1] });
    expect(entries).toContainEqual({ path: "outputs.humidity", status: "added", systemValue: sys[1] });
    expect(entries).toHaveLength(3);
  });

  it("falls back to whole-array comparison for positional arrays", () => {
    expect(diff({ value: [0, 100] }, { value: [0, 120] })).toEqual([
      { path: "value", status: "overridden", procedureValue: [0, 100], systemValue: [0, 120] },
    ]);
    expect(diff({ keywords: ["a", "b"] }, { keywords: ["a", "b"] })).toEqual([]);
  });

  it("falls back to whole-array comparison when keys are duplicated", () => {
    const proc = [{ name: "a", v: 1 }, { name: "a", v: 2 }];
    const sys = [{ name: "a", v: 1 }];
    expect(diff({ list: proc }, { list: sys })).toEqual([
      { path: "list", status: "overridden", procedureValue: proc, systemValue: sys },
    ]);
  });

  it("keys Term-like lists by definition with label fallback", () => {
    const proc = [{ definition: "def:serial", label: "Serial", value: "1" }];
    const sys = [
      { definition: "def:serial", label: "Serial", value: "2" },
      { definition: "def:model", label: "Model", value: "TP60S" },
    ];
    const entries = diff({ identifiers: proc }, { identifiers: sys });
    expect(entries).toContainEqual({
      path: "identifiers.def:serial.value",
      status: "overridden",
      procedureValue: "1",
      systemValue: "2",
    });
    expect(entries.find((e) => e.status === "added")?.path).toBe("identifiers.def:model");
  });

  it("emits unchanged leaf entries only when includeUnchanged is set", () => {
    expect(diff({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual([]);
    const entries = diff({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }, { includeUnchanged: true });
    expect(entries).toEqual([
      { path: "a", status: "unchanged", procedureValue: 1, systemValue: 1 },
      { path: "b", status: "unchanged", procedureValue: [1, 2], systemValue: [1, 2] },
    ]);
  });

  it("skips ignored paths and their subtrees", () => {
    const entries = diff(
      { a: { x: 1 }, b: 1, ab: 2 },
      { a: { x: 2 }, b: 2, ab: 3 },
      { ignorePaths: ["a", "b"] },
    );
    expect(entries).toEqual([{ path: "ab", status: "overridden", procedureValue: 2, systemValue: 3 }]);
  });

  it("applies ignorePaths to keyed-array element paths", () => {
    const entries = diff(
      { outputs: [{ name: "temp", v: 1 }] },
      { outputs: [{ name: "temp", v: 2 }, { name: "humidity", v: 3 }] },
      { ignorePaths: ["outputs.humidity"] },
    );
    expect(entries).toEqual([
      { path: "outputs.temp.v", status: "overridden", procedureValue: 1, systemValue: 2 },
    ]);
  });
});

describe("buildResult", () => {
  it("groups entries by status", () => {
    const ctx = createContext({ includeUnchanged: true });
    diffValues({ a: 1, b: 2, c: 3 }, { a: 1, b: 9, d: 4 }, "", ctx);
    const result = buildResult(ctx.entries);
    expect(result.entries).toHaveLength(4);
    expect(result.unchanged.map((e) => e.path)).toEqual(["a"]);
    expect(result.overridden.map((e) => e.path)).toEqual(["b"]);
    expect(result.removed.map((e) => e.path)).toEqual(["c"]);
    expect(result.added.map((e) => e.path)).toEqual(["d"]);
  });
});
