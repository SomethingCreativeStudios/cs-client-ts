import { describe, expect, it } from "vitest";
// TypeScript drops ambiguous star exports silently, so assert the path-ref API
// actually surfaces at the package root.
import * as root from "../../src/index.js";

describe("package root exports", () => {
  it("exposes the path-ref toolkit", () => {
    expect(typeof root.buildPathRefParts).toBe("function");
    expect(typeof root.walkComponentPathRefs).toBe("function");
    expect(typeof root.settingsTargetsFor).toBe("function");
    expect(typeof root.isPathRef).toBe("function");
    expect(typeof root.parsePathRef).toBe("function");
    expect(typeof root.composePathRef).toBe("function");
    expect(typeof root.sanitizePathRefSegment).toBe("function");
    expect(root.pathRefPrefixes).toHaveLength(5);
    expect(root.PATH_REF_PATTERN).toBeInstanceOf(RegExp);
  });
});
