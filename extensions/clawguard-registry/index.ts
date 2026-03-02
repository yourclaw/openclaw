import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "openclaw/plugin-sdk";
import { ClawGuardClient, type ClawGuardConfig } from "./src/client.js";

const plugin = {
  id: "clawguard-registry",
  name: "ClawGuard Registry",
  description:
    "Integrates with the ClawGuard skill trust registry to verify, score, and recommend AI agent skills.",
  version: "1.0.0",

  register(api: OpenClawPluginApi) {
    const config = (api.pluginConfig ?? {}) as Partial<ClawGuardConfig>;
    const client = new ClawGuardClient(config);
    const logger = api.logger;

    logger.info(
      `ClawGuard Registry initialized — endpoint: ${client.settings.registryUrl}, enforce: ${client.settings.enforceTrustScore}, min score: ${client.settings.minTrustScore}`,
    );

    // =========================================================================
    // Tool: clawguard_check_skill
    // =========================================================================
    api.registerTool(
      {
        name: "clawguard_check_skill",
        label: "ClawGuard Check Skill",
        description:
          "Check the trust score and security status of a skill in the ClawGuard registry. Use this before installing or using an unfamiliar skill to verify its safety.",
        parameters: Type.Object({
          skill: Type.String({
            description: "Skill name or ID to check (e.g., 'web-search', 'file-manager')",
          }),
        }),
        async execute(_toolCallId, params) {
          const { skill: skillId } = params as { skill: string };
          const info = await client.checkSkill(skillId);

          if (!info) {
            return {
              content: [
                {
                  type: "text",
                  text: `Skill "${skillId}" not found in the ClawGuard registry. This skill has not been verified — exercise caution.`,
                },
              ],
              details: { found: false, skillId },
            };
          }

          const assessment = client.formatTrustAssessment(info);
          const trusted = client.isSkillTrusted(info);

          return {
            content: [
              {
                type: "text",
                text: `${assessment}\n\nCategory: ${info.category}\nAuthor: ${info.author}\nLast Scanned: ${info.lastScanned}\nTags: ${info.tags.join(", ")}\n\n${trusted ? "This skill is approved for use." : "WARNING: This skill does not meet the minimum trust threshold. Proceed with caution."}`,
              },
            ],
            details: {
              found: true,
              trusted,
              trustScore: info.trustScore,
              verified: info.verified,
              vulnerabilities: info.vulnerabilities,
            },
          };
        },
      },
      { name: "clawguard_check_skill" },
    );

    // =========================================================================
    // Tool: clawguard_search_skills
    // =========================================================================
    api.registerTool(
      {
        name: "clawguard_search_skills",
        label: "ClawGuard Search Skills",
        description:
          "Search the ClawGuard registry for verified skills matching a query. Use this to discover trusted skills for a specific task.",
        parameters: Type.Object({
          query: Type.String({
            description: "Search query (e.g., 'web scraping', 'email', 'database')",
          }),
          limit: Type.Optional(
            Type.Number({ description: "Max results to return (default: 5)" }),
          ),
        }),
        async execute(_toolCallId, params) {
          const { query, limit = 5 } = params as { query: string; limit?: number };
          const result = await client.searchSkills(query, 1, limit);

          if (result.skills.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No skills found in the ClawGuard registry matching "${query}".`,
                },
              ],
              details: { count: 0, query },
            };
          }

          const lines = result.skills.map((s, i) => {
            const status = client.isSkillTrusted(s) ? "TRUSTED" : "CAUTION";
            return `${i + 1}. [${status}] ${s.name} — Trust: ${s.trustScore}/100 | ${s.description}`;
          });

          return {
            content: [
              {
                type: "text",
                text: `Found ${result.total} skills matching "${query}":\n\n${lines.join("\n")}`,
              },
            ],
            details: {
              count: result.total,
              skills: result.skills.map((s) => ({
                id: s.id,
                name: s.name,
                trustScore: s.trustScore,
                verified: s.verified,
              })),
            },
          };
        },
      },
      { name: "clawguard_search_skills" },
    );

    // =========================================================================
    // Tool: clawguard_top_skills
    // =========================================================================
    api.registerTool(
      {
        name: "clawguard_top_skills",
        label: "ClawGuard Top Skills",
        description:
          "Get the highest-rated and most trusted skills from the ClawGuard registry. Use this to discover recommended skills.",
        parameters: Type.Object({
          category: Type.Optional(
            Type.String({
              description:
                "Filter by category (e.g., 'productivity', 'security', 'communication', 'development')",
            }),
          ),
          limit: Type.Optional(
            Type.Number({ description: "Max results to return (default: 10)" }),
          ),
        }),
        async execute(_toolCallId, params) {
          const { category, limit = 10 } = params as {
            category?: string;
            limit?: number;
          };
          const skills = await client.getTopSkills(category, limit);

          if (skills.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: category
                    ? `No top skills found in category "${category}".`
                    : "No top skills available from the ClawGuard registry.",
                },
              ],
              details: { count: 0 },
            };
          }

          const lines = skills.map(
            (s, i) =>
              `${i + 1}. ${s.name} — Trust: ${s.trustScore}/100 | ${s.verified ? "Verified" : "Unverified"} | ${s.description}`,
          );

          return {
            content: [
              {
                type: "text",
                text: `Top ${skills.length} ClawGuard-verified skills${category ? ` in "${category}"` : ""}:\n\n${lines.join("\n")}`,
              },
            ],
            details: {
              count: skills.length,
              skills: skills.map((s) => ({
                id: s.id,
                name: s.name,
                trustScore: s.trustScore,
                verified: s.verified,
              })),
            },
          };
        },
      },
      { name: "clawguard_top_skills" },
    );

    // =========================================================================
    // Hook: before_tool_call — warn/block untrusted skills
    // =========================================================================
    if (client.settings.enforceTrustScore) {
      api.on("before_tool_call", async (event) => {
        const toolName = event.toolName;

        // Skip built-in tools (only check plugin/external tools)
        const builtinTools = new Set([
          "bash",
          "read_file",
          "write_file",
          "edit_file",
          "list_directory",
          "search_files",
          "web_search",
          "web_fetch",
        ]);
        if (builtinTools.has(toolName)) return;

        const info = await client.checkSkill(toolName);
        if (!info) {
          // Unknown skill — log but don't block (fail open)
          logger.debug(`ClawGuard: skill "${toolName}" not in registry — allowing (unverified)`);
          return;
        }

        if (!client.isSkillTrusted(info)) {
          logger.warn(
            `ClawGuard: skill "${toolName}" has trust score ${info.trustScore} (min: ${client.settings.minTrustScore}) — ${info.vulnerabilities.critical > 0 ? "BLOCKED (critical vulnerabilities)" : "warning issued"}`,
          );

          // Block skills with critical vulnerabilities
          if (info.vulnerabilities.critical > 0) {
            return {
              blocked: true,
              reason: `ClawGuard blocked skill "${toolName}": ${info.vulnerabilities.critical} critical vulnerabilities detected. Trust score: ${info.trustScore}/100.`,
            };
          }
        }
      });
    }

    // =========================================================================
    // Command: /clawguard — registry status
    // =========================================================================
    api.registerCommand({
      name: "clawguard",
      description: "Show ClawGuard registry status and configuration",
      handler: async () => {
        const settings = client.settings;
        return {
          text: [
            "ClawGuard Registry Status",
            `  Endpoint: ${settings.registryUrl}`,
            `  Enforce Trust Score: ${settings.enforceTrustScore}`,
            `  Min Trust Score: ${settings.minTrustScore}`,
            `  Prefer Registry Skills: ${settings.preferRegistrySkills}`,
          ].join("\n"),
          success: true,
        };
      },
    });
  },
};

export default plugin;
