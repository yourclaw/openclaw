# YourClaw Fork Patches

This directory contains YourClaw-specific patches applied on top of upstream OpenClaw.

## Contents

### Configuration

- `LAST_SYNCED_TAG` — The last upstream release tag that was synced into the `yourclaw` branch
- `security-defaults.json` — Security configuration overlay (sandbox, workspace-only FS, ClawGuard, skills extraDirs)
- `scan-ignore.json` — ClawGuard scan suppressions with audit trail references

### Source patches (applied during upstream sync)

- `frame-ancestors-configurable.patch` — CSP frame-ancestors env var (`OPENCLAW_FRAME_ANCESTORS`) support
- `pairing-bypass-on-disable-device-auth.patch` — Skip pairing when `dangerouslyDisableDeviceAuth` is true

### Deployment patches (applied during upstream sync)

- `docker-compose-hardening.patch` — Healthcheck, cap_drop, no-new-privileges, network_mode, depends_on, env defaults
- `dockerfile-oci-labels-and-hardening.patch` — OCI metadata labels, plugin dir permission normalization, CMD docs
- `dockerfile-chainguard.patch` — Zero-CVE container image based on Chainguard (new file)
- `security-md-trust-boundaries.patch` — Archive extraction + sub-agent delegation trust boundary docs
- `claude-deny-secrets.patch` — Claude Code deny rules to block reading .env, credentials, keys

### Open contributions welcome

- **OS-level sandbox enforcement:** The Claude Code deny rules block the `Read`, `Edit`, and common `Bash` commands (`cat`, `head`, `grep`, etc.) from accessing secrets. However, arbitrary Bash commands (`python -c`, `node -e`, pipe tricks) can still bypass these tool-level denies. True OS-level enforcement requires Claude Code's `sandbox.filesystem.allowRead` configuration, which restricts all Bash child processes at the OS level. Contributions to add and document this are welcome.

## Branch Strategy

- `main` — Mirrors upstream `openclaw/openclaw` main branch
- `yourclaw` — Our hardened fork (default branch) with security patches + ClawGuard integration
- `upstream-sync/*` — Temporary branches for upstream sync PRs

## Sync Process

The `upstream-sync.yml` GitHub Actions workflow:

1. Checks nightly for new upstream release tags
2. Scans each commit with ClawGuard scanner
3. Creates a PR to merge into `yourclaw` branch
4. Auto-merges if all scans pass and no conflicts

## Running the Hardened Docker Setup

### Prerequisites

- Docker and Docker Compose installed
- A `.env` file at the repo root (copy from `.env.example`)

### Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env: set OPENCLAW_GATEWAY_TOKEN, ANTHROPIC_API_KEY, etc.
export OPENCLAW_CONFIG_DIR=~/.openclaw
export OPENCLAW_WORKSPACE_DIR=~/.openclaw/workspace

# 2. Run upstream's setup script (builds image, generates docker-compose.extra.yml)
./docker-setup.sh
```

### Mounting an External Skills Directory

Use upstream's `OPENCLAW_EXTRA_MOUNTS` mechanism to bind-mount a host directory
into the container. The `security-defaults.json` overlay already configures
`skills.load.extraDirs` to look at `/home/node/external-skills`.

```bash
# Set the mount before running docker-setup.sh (or export in .env)
export OPENCLAW_EXTRA_MOUNTS=/path/to/your/skills:/home/node/external-skills:ro

# Run setup — this generates docker-compose.extra.yml with the mount
./docker-setup.sh
```

Each skill must be a subdirectory containing a `SKILL.md` file:

```
/path/to/your/skills/
  my-skill/
    SKILL.md
  another-skill/
    SKILL.md
```

### Manual Start (if already set up)

```bash
# With extra mounts
docker compose -f docker-compose.yml -f docker-compose.extra.yml up -d

# Without extra mounts (no skills directory)
docker compose up -d
```

### Verify

```bash
# Gateway health
curl http://127.0.0.1:18789/healthz

# Check loaded skills
docker compose -f docker-compose.yml -f docker-compose.extra.yml \
  exec openclaw-gateway node dist/index.js skills list

# Interactive CLI
docker compose -f docker-compose.yml -f docker-compose.extra.yml \
  run --rm openclaw-cli
```

### Applying security-defaults.json

Copy the security overlay into your config directory so the gateway picks it up.
Merge it into your existing `openclaw.json`, or use it as a starting point:

```bash
# If you don't have an openclaw.json yet
cp yourclaw-patches/security-defaults.json ~/.openclaw/openclaw.json

# If you already have one, merge the keys manually or via jq:
jq -s '.[0] * .[1]' ~/.openclaw/openclaw.json yourclaw-patches/security-defaults.json \
  > /tmp/merged.json && mv /tmp/merged.json ~/.openclaw/openclaw.json
```
