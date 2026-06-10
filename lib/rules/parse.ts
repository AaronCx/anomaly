import yaml from "js-yaml";
import type { ArchitectureRules, EdgeRule, LayerDef } from "./types";

/** The conventional location of the rules file in a scanned repo. */
export const RULES_FILE = ".anomaly.yml";

export class RulesParseError extends Error {}

function asEdgeRules(raw: unknown, field: string): EdgeRule[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new RulesParseError(`'${field}' must be a list`);
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new RulesParseError(`'${field}[${i}]' must be a {from, to} mapping`);
    }
    const { from, to } = item as Record<string, unknown>;
    if (typeof from !== "string" || typeof to !== "string") {
      throw new RulesParseError(`'${field}[${i}]' needs string 'from' and 'to'`);
    }
    return { from: normalizePrefix(from), to: normalizePrefix(to) };
  });
}

function asLayers(raw: unknown): LayerDef[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new RulesParseError("'layers' must be a list");
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new RulesParseError(`'layers[${i}]' must be a mapping`);
    }
    const { name, paths } = item as Record<string, unknown>;
    if (typeof name !== "string" || !name) {
      throw new RulesParseError(`'layers[${i}].name' is required`);
    }
    const pathList = paths == null ? [] : paths;
    if (!Array.isArray(pathList) || pathList.some((p) => typeof p !== "string")) {
      throw new RulesParseError(`'layers[${i}].paths' must be a list of strings`);
    }
    return { name, paths: (pathList as string[]).map(normalizePrefix) };
  });
}

/** Strip leading "./" and trailing "/" so prefixes compare cleanly. */
export function normalizePrefix(p: string): string {
  return p.replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * Parse `.anomaly.yml` text into ArchitectureRules. Returns null for empty
 * input (no rules file). Throws RulesParseError on malformed input.
 */
export function parseArchitectureRules(text: string): ArchitectureRules | null {
  if (!text.trim()) return null;
  let doc: unknown;
  try {
    doc = yaml.load(text);
  } catch (e) {
    throw new RulesParseError(`Invalid YAML: ${(e as Error).message}`);
  }
  if (doc == null) return null;
  if (typeof doc !== "object") throw new RulesParseError("Rules file must be a mapping");
  const obj = doc as Record<string, unknown>;
  return {
    layers: asLayers(obj.layers),
    forbidden: asEdgeRules(obj.forbidden, "forbidden"),
    allow: asEdgeRules(obj.allow, "allow"),
  };
}
