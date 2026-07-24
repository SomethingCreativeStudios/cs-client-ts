import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DataStreamSchema } from "../../src/models/resources/data-stream.js";
import { ControlStreamSchema } from "../../src/models/resources/control-stream.js";
import { ObservationCreateSchema, ObservationSchema } from "../../src/models/resources/observation.js";
import {
  CommandCreateSchema,
  CommandResultCreateSchema,
  CommandResultSchema,
  CommandSchema,
  CommandStatusCreateSchema,
  CommandStatusSchema,
} from "../../src/models/resources/command.js";
import { SystemEventSchema } from "../../src/models/resources/system-event.js";
import { ObservationSchemaDescriptorSchema } from "../../src/models/resources/observation-schema.js";
import { CommandSchemaDescriptorSchema } from "../../src/models/resources/command-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "..", "fixtures", "resources");

function jsonFiles(subdir: string): string[] {
  return readdirSync(join(fixturesRoot, subdir)).filter((f) => f.endsWith(".json"));
}

function load(subdir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(fixturesRoot, subdir, file), "utf-8"));
}

function expectParses(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, file: string, json: unknown) {
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(`${file}: ${JSON.stringify(result.error, null, 2)}`);
  }
}

describe("DataStreamSchema", () => {
  it.each(jsonFiles("datastream").filter((file) => file !== "datastream-external-link-edr.json"))("parses response fixture %s", (file) => {
    expectParses(DataStreamSchema, file, load("datastream", file));
  });

  it("normalizes omitted nullable response fields while preserving strict identity fields", () => {
    const result = DataStreamSchema.safeParse(load("datastream", "datastream-external-link-edr.json"));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.live).toBeNull();
  });

  it("derives formats from an echoed write-only schema", () => {
    const source = load("datastream", "datastream-simple.json") as Record<string, unknown>;
    const result = DataStreamSchema.parse({
      ...source,
      formats: undefined,
      phenomenonTime: undefined,
      resultTime: undefined,
      schema: { obsFormat: "application/json" },
    });

    expect(result.formats).toEqual(["application/json"]);
    expect(result.phenomenonTime).toBeNull();
    expect(result.resultTime).toBeNull();
    expect(result.schema).toEqual({ obsFormat: "application/json" });
  });

  it("requires the OpenAPI response fields", () => {
    const result = DataStreamSchema.safeParse({ name: "Temperature" });
    expect(result.success).toBe(false);
  });
});

describe("ControlStreamSchema", () => {
  it.each(jsonFiles("controlstream"))("parses fixture %s", (file) => {
    expectParses(ControlStreamSchema, file, load("controlstream", file));
  });

  it("requires the OpenAPI response fields", () => {
    const result = ControlStreamSchema.safeParse({ name: "PTZ" });
    expect(result.success).toBe(false);
  });

  it("defaults omitted response state and ignores an invalid echoed write-only schema", () => {
    const source = load("controlstream", jsonFiles("controlstream")[0]!) as Record<string, unknown>;
    const result = ControlStreamSchema.parse({
      ...source,
      issueTime: undefined,
      executionTime: undefined,
      live: undefined,
      async: undefined,
      schema: {
        commandFormat: "application/json",
        parametersSchema: {
          type: "Quantity",
          definition: "urn:test:speed",
        },
      },
    });

    expect(result.issueTime).toBeNull();
    expect(result.executionTime).toBeNull();
    expect(result.live).toBeNull();
    expect(result.async).toBe(false);
    expect(result.schema).toBeUndefined();
  });
});

describe("ObservationSchema", () => {
  it.each(jsonFiles("observation"))("parses fixture %s", (file) => {
    expectParses(ObservationSchema, file, load("observation", file));
  });

  it("rejects an observation with neither result nor result@link", () => {
    const result = ObservationSchema.safeParse({ id: "1", "datastream@id": "ds1", resultTime: "2020-01-01T00:00:00Z" });
    expect(result.success).toBe(false);
  });

  it("requires the OpenAPI response identity and resultTime fields", () => {
    const result = ObservationSchema.safeParse({ result: 1 });
    expect(result.success).toBe(false);
    expect(ObservationCreateSchema.safeParse({ result: 1 }).success).toBe(true);
  });

  it("rejects an observation with both result and result@link", () => {
    const result = ObservationSchema.safeParse({
      id: "1",
      "datastream@id": "ds1",
      resultTime: "2020-01-01T00:00:00Z",
      result: 1,
      "result@link": { href: "https://example.org/x" },
    });
    expect(result.success).toBe(false);
  });

  it("models response links as first-class fields", () => {
    const result = ObservationSchema.parse({
      id: "o1",
      "datastream@id": "ds1",
      resultTime: "2020-01-01T00:00:00Z",
      result: 1,
      links: [{ href: "/observations/o1", rel: "self" }],
    });
    expect(result.links?.[0]?.rel).toBe("self");
  });
});

describe("CommandSchema", () => {
  it.each(jsonFiles("command").filter((file) => file !== "uav-mission.json"))("parses response fixture %s", (file) => {
    expectParses(CommandSchema, file, load("command", file));
  });

  it("keeps command create payloads separate from response validation", () => {
    const createPayload = load("command", "uav-mission.json");
    expect(CommandSchema.safeParse(createPayload).success).toBe(false);
    expectParses(CommandCreateSchema, "uav-mission.json", createPayload);
  });

  it("models response links as first-class fields", () => {
    const result = CommandSchema.parse({
      id: "c1",
      "controlstream@id": "cs1",
      issueTime: "2020-01-01T00:00:00Z",
      parameters: {},
      links: [{ href: "/commands/c1", rel: "self" }],
    });
    expect(result.links?.[0]?.rel).toBe("self");
  });
});

describe("CommandStatusSchema", () => {
  it.each(jsonFiles("commandStatus").filter((file) => !file.includes("inline-result")))("parses response fixture %s", (file) => {
    expectParses(CommandStatusSchema, file, load("commandStatus", file));
  });

  it.each(jsonFiles("commandStatus"))("parses create/status-report payload %s", (file) => {
    expectParses(CommandStatusCreateSchema, file, load("commandStatus", file));
  });
});

describe("CommandResultSchema", () => {
  it.each(jsonFiles("commandResult"))("parses create/result payload %s", (file) => {
    expectParses(CommandResultCreateSchema, file, load("commandResult", file));
  });

  it("requires response identity fields", () => {
    const createPayload = load("commandResult", "command-result-inline.json");
    expect(CommandResultSchema.safeParse(createPayload).success).toBe(false);
    expectParses(CommandResultSchema, "command-result-inline-response.json", {
      id: "r1",
      "command@id": "cmd1",
      ...(createPayload as Record<string, unknown>),
    });
  });

  it("rejects ambiguous result variants", () => {
    const result = CommandResultCreateSchema.safeParse({
      data: 1,
      "observation@link": { href: "https://example.org/observations/o1" },
    });
    expect(result.success).toBe(false);
  });
});

describe("SystemEventSchema", () => {
  it.each(jsonFiles("event"))("parses fixture %s", (file) => {
    expectParses(SystemEventSchema, file, load("event", file));
  });
});

describe("ObservationSchemaDescriptorSchema", () => {
  it.each(jsonFiles("obsSchema"))("parses fixture %s", (file) => {
    expectParses(ObservationSchemaDescriptorSchema, file, load("obsSchema", file));
  });

  it("does not let malformed SWE CSV descriptors fall through as other", () => {
    expect(ObservationSchemaDescriptorSchema.safeParse({ obsFormat: "application/swe+csv" }).success).toBe(false);
  });
});

describe("CommandSchemaDescriptorSchema", () => {
  it.each(jsonFiles("cmdSchema"))("parses fixture %s", (file) => {
    expectParses(CommandSchemaDescriptorSchema, file, load("cmdSchema", file));
  });

  it("does not let malformed SWE CSV descriptors fall through as other", () => {
    expect(CommandSchemaDescriptorSchema.safeParse({ commandFormat: "application/swe+csv" }).success).toBe(false);
  });
});
