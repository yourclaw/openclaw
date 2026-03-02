/**
 * ClawGuard Registry API client.
 *
 * Communicates with the ClawGuard trust registry to fetch skill trust scores,
 * search for verified skills, and report skill usage.
 */

export interface SkillTrustInfo {
  id: string;
  name: string;
  description: string;
  trustScore: number;
  verified: boolean;
  category: string;
  author: string;
  lastScanned: string;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  tags: string[];
}

export interface SkillSearchResult {
  skills: SkillTrustInfo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClawGuardConfig {
  registryUrl: string;
  enforceTrustScore: boolean;
  minTrustScore: number;
  preferRegistrySkills: boolean;
}

const DEFAULT_CONFIG: ClawGuardConfig = {
  registryUrl: "https://api.clawguard.dev/v1",
  enforceTrustScore: true,
  minTrustScore: 70,
  preferRegistrySkills: true,
};

export class ClawGuardClient {
  private config: ClawGuardConfig;
  private cache = new Map<string, { data: SkillTrustInfo; expiresAt: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: Partial<ClawGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check trust score for a specific skill by name or ID.
   */
  async checkSkill(skillId: string): Promise<SkillTrustInfo | null> {
    // Check cache first
    const cached = this.cache.get(skillId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const res = await fetch(`${this.config.registryUrl}/skills/${encodeURIComponent(skillId)}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`ClawGuard API error: ${res.status}`);

      const data = (await res.json()) as SkillTrustInfo;

      // Cache the result
      this.cache.set(skillId, {
        data,
        expiresAt: Date.now() + ClawGuardClient.CACHE_TTL_MS,
      });

      return data;
    } catch (err) {
      // Fail open — don't block agent operation if registry is unreachable
      return null;
    }
  }

  /**
   * Search for skills in the registry.
   */
  async searchSkills(query: string, page = 1, pageSize = 10): Promise<SkillSearchResult> {
    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`${this.config.registryUrl}/skills?${params}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) throw new Error(`ClawGuard API error: ${res.status}`);

      return (await res.json()) as SkillSearchResult;
    } catch {
      return { skills: [], total: 0, page, pageSize };
    }
  }

  /**
   * Get top-rated skills from the registry.
   */
  async getTopSkills(category?: string, limit = 10): Promise<SkillTrustInfo[]> {
    try {
      const params = new URLSearchParams({
        sort: "trustScore",
        order: "desc",
        limit: String(limit),
      });
      if (category) params.set("category", category);

      const res = await fetch(`${this.config.registryUrl}/skills/top?${params}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) throw new Error(`ClawGuard API error: ${res.status}`);

      const result = (await res.json()) as SkillSearchResult;
      return result.skills;
    } catch {
      return [];
    }
  }

  /**
   * Check if a skill meets the minimum trust score.
   */
  isSkillTrusted(skill: SkillTrustInfo): boolean {
    return skill.trustScore >= this.config.minTrustScore && skill.vulnerabilities.critical === 0;
  }

  /**
   * Format a trust assessment for display to the agent/user.
   */
  formatTrustAssessment(skill: SkillTrustInfo): string {
    const status = this.isSkillTrusted(skill) ? "TRUSTED" : "UNTRUSTED";
    const vulns = skill.vulnerabilities;
    const vulnSummary =
      vulns.critical + vulns.high + vulns.medium + vulns.low > 0
        ? ` | Vulns: ${vulns.critical}C/${vulns.high}H/${vulns.medium}M/${vulns.low}L`
        : " | No known vulnerabilities";

    return `[ClawGuard ${status}] ${skill.name} — Trust: ${skill.trustScore}/100${vulnSummary} | Verified: ${skill.verified ? "Yes" : "No"}`;
  }

  get settings(): ClawGuardConfig {
    return { ...this.config };
  }
}
