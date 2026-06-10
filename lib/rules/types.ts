/**
 * Architecture rules declared in `.anomaly.yml`. Layers are an ordered list,
 * top to bottom: a layer may depend on layers *below* it (later in the list),
 * never above. `forbidden` adds explicit path-glob bans; `allow` whitelists
 * exceptions that override both checks.
 */
export interface LayerDef {
  name: string;
  /** Path prefixes that belong to this layer (e.g. "app", "components"). */
  paths: string[];
}

export interface EdgeRule {
  /** Path prefix of the importing file. */
  from: string;
  /** Path prefix of the imported file. */
  to: string;
}

export interface ArchitectureRules {
  layers: LayerDef[];
  forbidden: EdgeRule[];
  allow: EdgeRule[];
}

export type ViolationKind = "layer-direction" | "forbidden-import";

export interface Violation {
  /** Importing file (graph node id / filePath). */
  source: string;
  /** Imported file. */
  target: string;
  kind: ViolationKind;
  message: string;
  /** Layers involved, when kind is "layer-direction". */
  fromLayer?: string;
  toLayer?: string;
}

export interface DriftReport {
  violations: Violation[];
  /** Import/call edges that were checkable (both endpoints in a known layer, or matched a forbidden rule). */
  checkedEdges: number;
  totalEdges: number;
  /** Percentage of checked edges that violate the rules, 0–100. */
  driftScore: number;
}
