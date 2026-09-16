/*
 * api.ts
 * A thin wrapper around decomp.dev's API
 *
 * Made by @gee.wzz
 */

/**
 * Maps a platform's short identifier (as returned by the decomp.dev API)
 * to its human-readable display name.
 */
export const platforms = {
  "3ds": "Nintendo 3DS",
  n64: "Nintendo 64",
  wii: "Wii",
  gc: "GameCube",
  win32: "Windows",
  gba: "Game Boy Advance",
  nds: "Nintendo DS",
  xbox360: "Xbox 360",
  ps: "PlayStation",
  ps2: "PlayStation 2",
  psp: "PlayStation Portable",
  xbox: "Xbox",
  switch: "Nintendo Switch",
} as const;

/** A known platform identifier, e.g. `"n64"` or `"switch"`. */
export type PlatformId = keyof typeof platforms;

/** A human-readable platform name, e.g. `"Nintendo 64"`. */
export type PlatformName = (typeof platforms)[PlatformId];

/**
 * A decomp.dev project: a reverse-engineering effort tracked for a
 * specific game/platform combination.
 */
export interface DecompProject {
  /** Unique numeric identifier for the project. */
  id: number;

  /** Short platform identifier as returned by the API, e.g. `"n64"`. */
  platformId: PlatformId;

  /** Human-readable platform name, e.g. `"Nintendo 64"`. */
  platformName: string;

  /** URL or `owner/repo` slug of the project's source repository. */
  repository: string;

  /** Human-readable name shown in the UI, e.g. `"Super Mario 64"`. */
  displayName: string;
}

/** Raw shape of a project's status/measures, as returned by decomp.dev. */
interface RawDecompMeasures {
  fuzzy_match_percent: number;
  total_code: string;
  matched_code: string;
  matched_code_percent: number;
  total_data: string;
  matched_data: string;
  matched_data_percent: number;
  total_functions: number;
  matched_functions: number;
  matched_functions_percent: number;
  total_units: number;
}

/**
 * A decomp project enriched with decompilation progress data.
 */
export interface DecompStatus extends DecompProject {
  /** URL to the project's treemap visualization (SVG). */
  treemapUrl: string;

  /** Matched code percentage, from 0 to 100. */
  percentage: number;

  /** Fuzzy match percentage, from 0 to 100 (looser similarity metric than exact match). */
  fuzzyMatchPercent: number;

  /** Matched functions percentage, from 0 to 100. */
  matchedFunctionsPercent: number;

  /** Matched data percentage, from 0 to 100. */
  matchedDataPercent: number;

  /** Total number of translation units in the project. */
  totalUnits: number;

  /** Total number of functions in the project. */
  totalFunctions: number;

  /** Number of functions matched so far. */
  matchedFunctions: number;
}

/** Raw shape of a single project as returned by the decomp.dev API. */
interface RawDecompProject {
  id: number;
  owner: string;
  repo: string;
  repo_url: string;
  name: string;
  short_name: string | null;
  platform: string;
  default_version: string;
  default_category: string | null;
  commit: {
    sha: string;
    message: string;
    timestamp: string;
  };
  report_versions: string[];
  report_categories: unknown[];
  measures: RawDecompMeasures;
}

/**
 * Resolves a platform id to its display name.
 *
 * @param id The platform identifier returned by the API.
 * @returns The display name if known, otherwise the original id unchanged.
 *
 * @example
 * ```ts
 * getPlatformName("gc"); // "GameCube"
 * getPlatformName("ps3"); // "ps3" (fallback, unknown platform)
 * ```
 */
function getPlatformName(id: string): string {
  type PlatformKey = keyof typeof platforms;
  if (id in platforms) {
    return platforms[id as PlatformKey];
  }
  return id;
}

const DECOMP_BASE_URL = "https://decomp.dev";
const DECOMP_PROJECTS_URL = `${DECOMP_BASE_URL}/projects?sort=name`;

/**
 * Builds the decomp.dev API URL for a project's measures JSON.
 */
function buildMeasuresUrl(id: number): string {
  return `${DECOMP_BASE_URL}/projects/${id}.json?mode=measures`;
}

/**
 * Builds the decomp.dev treemap SVG URL for a project.
 */
function buildTreemapUrl(id: number): string {
  return `${DECOMP_BASE_URL}/projects/${id}.png?mode=overview`;
}

/**
 * Fetches all decomp.dev projects sorted by name, and parses the
 * response into a structured list of {@link DecompProject} objects.
 *
 * @returns A promise resolving to the parsed project list.
 * @throws If the request fails or the response is not OK.
 */
export async function getProjects(): Promise<DecompStatus[]> {
  const res = await fetch(DECOMP_PROJECTS_URL, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("projects" in data)) {
    throw new Error("Invalid response format");
  }

  type ResponseData = { projects: RawDecompProject[] };
  const { projects } = data as ResponseData;

  return projects.map((project): DecompStatus => {
    type PlatformKey = keyof typeof platforms;
    const platformId: PlatformId =
      project.platform in platforms
        ? (project.platform as PlatformKey)
        : (project.platform as PlatformId);
    return {
      id: project.id,
      platformId,
      platformName: getPlatformName(project.platform),
      repository: project.repo_url,
      displayName: project.short_name ?? project.name,
      treemapUrl: buildTreemapUrl(project.id),
      percentage: project.measures.matched_code_percent,
      fuzzyMatchPercent: project.measures.fuzzy_match_percent,
      matchedFunctionsPercent: project.measures.matched_functions_percent,
      matchedDataPercent: project.measures.matched_data_percent,
      totalUnits: project.measures.total_units,
      totalFunctions: project.measures.total_functions,
      matchedFunctions: project.measures.matched_functions,
    };
  });
}

/**
 * Fetches decompilation progress data for a single project and merges
 * it with the base {@link DecompProject} info.
 *
 * @param project The base project info (from {@link getProjects}).
 * @returns A promise resolving to the enriched {@link DecompStatus}.
 * @throws If the request fails or the response is not OK.
 */
export async function getProjectStatus(project: DecompProject): Promise<DecompStatus> {
  const res = await fetch(buildMeasuresUrl(project.id), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch status for project ${project.id}: ${res.status} ${res.statusText}`,
    );
  }

  const measures = (await res.json()) as RawDecompMeasures;

  return {
    ...project,
    treemapUrl: buildTreemapUrl(project.id),
    percentage: measures.matched_code_percent,
    fuzzyMatchPercent: measures.fuzzy_match_percent,
    matchedFunctionsPercent: measures.matched_functions_percent,
    matchedDataPercent: measures.matched_data_percent,
    totalUnits: measures.total_units,
    totalFunctions: measures.total_functions,
    matchedFunctions: measures.matched_functions,
  };
}

const GITHUB_PREFIX = "https://github.com/";

/**
 * Normalizes a repo reference into a full GitHub URL. Accepts either
 * a full URL or an `owner/repo` shorthand. Case-insensitive and
 * tolerant of extra whitespace or stray leading/trailing slashes.
 *
 * @example
 * normalizeRepoUrl("zeldaret/tww"); // "https://github.com/zeldaret/tww"
 * normalizeRepoUrl("  ZeldaRet/TWW/ "); // "https://github.com/zeldaret/tww"
 * normalizeRepoUrl("https://github.com/zeldaret/tww"); // unchanged (lowercased)
 */
export function normalizeRepoUrl(input: string): string {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${GITHUB_PREFIX}${trimmed}`;
}

/**
 * Resolves a user-provided platform name or id into a known
 * {@link PlatformId}. Case-insensitive; matches either the short id
 * (e.g. `"n64"`) or the display name (e.g. `"Nintendo 64"`).
 *
 * @param input Freeform platform text, as typed by a user.
 * @returns The matching platform id, or `undefined` if no platform matches.
 *
 * @example
 * resolvePlatformId("n64"); // "n64"
 * resolvePlatformId("Nintendo 64"); // "n64"
 * resolvePlatformId("dreamcast"); // undefined
 */
export function resolvePlatformId(input: string): PlatformId | undefined {
  const normalized = input.trim().toLowerCase();
  const entry = Object.entries(platforms).find(
    ([id, name]) => id.toLowerCase() === normalized || name.toLowerCase() === normalized,
  );
  if (!entry) return undefined;
  const [key] = entry;
  type PlatformKey = keyof typeof platforms;
  if (key in platforms) {
    return key as PlatformKey;
  }
  return undefined;
}
