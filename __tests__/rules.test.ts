import { describe, it, expect } from "vitest";
import { parseArchitectureRules, RulesParseError, normalizePrefix } from "@/lib/rules/parse";
import {
  assignLayer,
  checkArchitecture,
  pathUnder,
  violationEdgeKeys,
  violationKey,
} from "@/lib/rules/check";
import type { ArchitectureRules } from "@/lib/rules/types";
import type { GraphData, GraphEdge } from "@/lib/graph/types";

const RULES_YML = `
layers:
  - name: ui
    paths: ["app", "components"]
  - name: services
    paths: ["lib/services", "lib/loader"]
  - name: data
    paths: ["lib/db"]
forbidden:
  - from: components
    to: lib/db
allow:
  - from: app
    to: lib/db
`;

function rules(): ArchitectureRules {
  const r = parseArchitectureRules(RULES_YML);
  if (!r) throw new Error("expected rules");
  return r;
}

function graph(edges: Array<[string, string, GraphEdge["type"]?]>): GraphData {
  return {
    nodes: [],
    clusters: [],
    edges: edges.map(([source, target, type = "import"]) => ({
      source,
      target,
      type,
      weight: 1,
    })),
  };
}

describe("parseArchitectureRules", () => {
  it("parses layers, forbidden, and allow", () => {
    const r = rules();
    expect(r.layers.map((l) => l.name)).toEqual(["ui", "services", "data"]);
    expect(r.forbidden).toEqual([{ from: "components", to: "lib/db" }]);
    expect(r.allow).toEqual([{ from: "app", to: "lib/db" }]);
  });

  it("returns null for empty input", () => {
    expect(parseArchitectureRules("")).toBeNull();
    expect(parseArchitectureRules("   \n")).toBeNull();
  });

  it("normalizes path prefixes (strips ./ and trailing /)", () => {
    expect(normalizePrefix("./lib/db/")).toBe("lib/db");
    const r = parseArchitectureRules(`layers:\n  - name: x\n    paths: ["./app/"]`);
    expect(r!.layers[0].paths).toEqual(["app"]);
  });

  it("throws on malformed YAML and bad shapes", () => {
    expect(() => parseArchitectureRules("layers: [")).toThrow(RulesParseError);
    expect(() => parseArchitectureRules("forbidden:\n  - from: x")).toThrow(RulesParseError);
    expect(() => parseArchitectureRules("layers:\n  - paths: [a]")).toThrow(RulesParseError);
  });
});

describe("pathUnder / assignLayer", () => {
  it("matches a file under a prefix but not a sibling prefix", () => {
    expect(pathUnder("lib/db/conn.ts", "lib/db")).toBe(true);
    expect(pathUnder("lib/db", "lib/db")).toBe(true);
    expect(pathUnder("lib/dbutil/x.ts", "lib/db")).toBe(false);
  });

  it("assigns the longest matching prefix (nested layer wins)", () => {
    const r = parseArchitectureRules(`
layers:
  - name: lib
    paths: ["lib"]
  - name: data
    paths: ["lib/db"]
`)!;
    expect(assignLayer("lib/db/conn.ts", r)).toBe("data");
    expect(assignLayer("lib/util.ts", r)).toBe("lib");
  });

  it("returns null for files in no layer", () => {
    expect(assignLayer("scripts/build.ts", rules())).toBeNull();
  });
});

describe("checkArchitecture", () => {
  it("flags a backward (data → ui) dependency", () => {
    const report = checkArchitecture(graph([["lib/db/conn.ts", "components/Btn.tsx"]]), rules());
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].kind).toBe("layer-direction");
    expect(report.violations[0].fromLayer).toBe("data");
    expect(report.violations[0].toLayer).toBe("ui");
    expect(report.driftScore).toBe(100);
  });

  it("allows a forward (ui → data) dependency", () => {
    const report = checkArchitecture(graph([["app/page.tsx", "lib/services/x.ts"]]), rules());
    expect(report.violations).toHaveLength(0);
    expect(report.driftScore).toBe(0);
    expect(report.checkedEdges).toBe(1);
  });

  it("flags a forbidden import even when the direction is forward", () => {
    const report = checkArchitecture(graph([["components/Btn.tsx", "lib/db/conn.ts"]]), rules());
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].kind).toBe("forbidden-import");
  });

  it("respects allow exceptions over both layer and forbidden checks", () => {
    // app → lib/db is a forward edge but allow-listed; no violation.
    const report = checkArchitecture(graph([["app/page.tsx", "lib/db/conn.ts"]]), rules());
    expect(report.violations).toHaveLength(0);
  });

  it("ignores export edges and self-edges", () => {
    const report = checkArchitecture(
      graph([
        ["lib/db/a.ts", "components/b.tsx", "export"],
        ["app/x.ts", "app/x.ts"],
      ]),
      rules(),
    );
    expect(report.violations).toHaveLength(0);
  });

  it("skips edges with an endpoint outside all layers", () => {
    const report = checkArchitecture(graph([["scripts/x.ts", "components/b.tsx"]]), rules());
    expect(report.violations).toHaveLength(0);
    expect(report.checkedEdges).toBe(0);
  });

  it("computes drift score as violations / checked edges", () => {
    const report = checkArchitecture(
      graph([
        ["app/a.tsx", "lib/services/s.ts"], // ok
        ["app/b.tsx", "lib/services/s.ts"], // ok
        ["lib/db/c.ts", "app/a.tsx"], // backward → violation
        ["lib/services/s.ts", "components/b.tsx"], // backward → violation
      ]),
      rules(),
    );
    expect(report.violations).toHaveLength(2);
    expect(report.checkedEdges).toBe(4);
    expect(report.driftScore).toBe(50);
  });

  it("exposes a violation-key set for renderer lookup", () => {
    const report = checkArchitecture(graph([["lib/db/c.ts", "app/a.tsx"]]), rules());
    const keys = violationEdgeKeys(report);
    expect(keys.has(violationKey({ source: "lib/db/c.ts", target: "app/a.tsx" }))).toBe(true);
  });
});
