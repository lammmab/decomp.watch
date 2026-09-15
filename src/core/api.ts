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
const platforms = {
  n64: "Nintendo 64",
  wii: "Wii",
  gc: "GameCube",
  win32: "Windows",
  gba: "Game Boy Advance",
  nds: "Nintendo DS",
  xbox360: "Xbox 360",
  ps2: "PlayStation 2",
  xbox: "Xbox",
  switch: "Nintendo Switch",
} as const;

/** A known platform identifier, e.g. `"n64"` or `"switch"`. */
type PlatformId = keyof typeof platforms;

/** A human-readable platform name, e.g. `"Nintendo 64"`. */
type PlatformName = (typeof platforms)[PlatformId];

/**
 * A decomp.dev project: a reverse-engineering effort tracked for a
 * specific game/platform combination.
 */
interface DecompProject {
  /** Unique numeric identifier for the project. */
  id: number;

  /** Short platform identifier as returned by the API, e.g. `"n64"`. */
  platformId: PlatformId;

  /** Human-readable platform name, e.g. `"Nintendo 64"`. */
  platformName: PlatformName | string;

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
interface DecompStatus extends DecompProject {
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
};

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
function getPlatformName(id: string): PlatformName | string {
  return platforms[id as PlatformId] ?? id;
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
  return `${DECOMP_BASE_URL}/projects/${id}.svg?mode=overview`;
}

/**
 * Fetches all decomp.dev projects sorted by name, and parses the
 * response into a structured list of {@link DecompProject} objects.
 *
 * @returns A promise resolving to the parsed project list.
 * @throws If the request fails or the response is not OK.
 */
export async function getProjects(): Promise<DecompProject[]> {
  const res = await fetch(DECOMP_PROJECTS_URL, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
  }

  const data: RawDecompProject[] = await res.json();

  return data.map((project): DecompProject => ({
    id: project.id,
    platformId: project.platform as PlatformId,
    platformName: getPlatformName(project.platform),
    repository: project.repo_url,
    displayName: project.short_name ?? project.name,
  }));
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
      `Failed to fetch status for project ${project.id}: ${res.status} ${res.statusText}`
    );
  }

  const measures: RawDecompMeasures = await res.json();

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
