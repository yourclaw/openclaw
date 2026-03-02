# YourClaw Fork Patches

This directory contains YourClaw-specific patches applied on top of upstream OpenClaw.

## Contents

- `LAST_SYNCED_TAG` — The last upstream release tag that was synced into the `yourclaw` branch
- `security-defaults.json` — Security configuration overlay applied to all YourClaw instances
- `Dockerfile.chainguard` — Zero-CVE container image based on Chainguard

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
