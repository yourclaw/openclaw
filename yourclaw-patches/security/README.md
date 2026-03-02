# Security Patches

This directory contains `.patch` files that are automatically applied after
merging upstream release tags, **before** the ClawGuard security scan runs.

## How it works

1. The upstream-sync workflow merges the new release tag into `yourclaw`
2. All `.patch` files in this directory are applied with `git apply`
3. The ClawGuard scanner runs on the patched code
4. If a patch fails to apply (e.g. upstream fixed the issue), it's skipped with a warning

## When to add a patch

- **Real vulnerabilities** found by the scanner that upstream hasn't fixed yet
- **Security hardening** (e.g. restricting default permissions)
- Do NOT use patches for false positives — add those to `scan-ignore.json` instead

## Naming convention

```
NNN-short-description.patch
```

Example: `001-fix-acpx-spawn-shell.patch`

## Creating a patch

```bash
# Make your fix on a branch
git diff > yourclaw-patches/security/001-description.patch
```

## Lifecycle

When upstream fixes the issue, the patch will fail to apply cleanly.
The workflow logs a warning, and you should remove the obsolete patch file.
