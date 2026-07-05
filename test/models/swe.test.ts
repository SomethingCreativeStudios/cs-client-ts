import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AnyComponentSchema } from "../../src/models/swe/any-component.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures", "swe");

const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

describe("AnyComponentSchema", () => {
  it.each(fixtures)("parses fixture %s", (file) => {
    const json = JSON.parse(readFileSync(join(fixturesDir, file), "utf-8"));
    const result = AnyComponentSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`${file}: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.data).toMatchObject({ type: json.type });
  });
});
