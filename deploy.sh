#!/usr/bin/env bash
# deploy.sh — deploy WWW_PAINT to Cloudflare Pages.
#
# Static site (no build step). Stages only the app files (excludes dev
# references, vendored source and local artifacts) then pushes to the
# `www-paint` Cloudflare Pages project.
#
# Credentials are pulled from Bitwarden (item: HERMES_CLOUDFLARE_API) at run
# time and never written to disk in cleartext. Requires the Bitwarden CLI to
# be unlocked (session in the profile's .bw-session file).
#
# Usage:  ./deploy.sh
set -euo pipefail

PROJECT="www-paint"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="${HOME}/.hermes/profiles/chief-of-staff"
BW_ITEM_ID="f52fb689"   # Bitwarden item: HERMES_CLOUDFLARE_API
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# ── 1. Resolve Cloudflare credentials from Bitwarden ────────────────────────
BW_SESSION="$(cat "${PROFILE_DIR}/.bw-session" 2>/dev/null || true)"
if [ -z "${BW_SESSION}" ] || ! BW_SESSION="$BW_SESSION" bw list items >/dev/null 2>&1; then
  echo "Bitwarden is locked. Run: python3 ${PROFILE_DIR}/bin/bw-unlock.py unlock" >&2
  exit 1
fi

CREDS="$(BW_SESSION="$BW_SESSION" bw get item "$BW_ITEM_ID" | python3 -c '
import json, sys
note = (json.load(sys.stdin).get("notes") or "")
acct = token = ""
for line in note.splitlines():
    line = line.strip()
    if line.startswith("Account ID"):
        acct = line.split("Account ID", 1)[1].strip(" :=\t")
    if line.startswith("API_TOKEN"):
        token = line.split("API_TOKEN", 1)[1].strip(" :=\t")
print(acct); print(token)
')"
CF_ACCOUNT_ID="$(echo "$CREDS" | sed -n 1p)"
CF_API_TOKEN="$(echo "$CREDS" | sed -n 2p)"

if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ]; then
  echo "Failed to resolve Cloudflare credentials from Bitwarden item $BW_ITEM_ID" >&2
  exit 1
fi
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"

# ── 2. Stage only app files ─────────────────────────────────────────────────
rsync -a \
  --exclude '_reference/' --exclude '_p5brush/' --exclude '_nothing_cn/' --exclude '_nothing_design/' \
  --exclude '_skills/' --exclude 'node_modules/' --exclude '.turbo/' --exclude 'graphify-out/' \
  --exclude '.git/' --exclude '.github/' --exclude 'docs/' --exclude 'tests/' --exclude 'test-images/' \
  --exclude 'test-*.png' --exclude 'test-*.html' --exclude 'app-test-result.png' --exclude '_probe_brush.html' \
  --exclude 'assets/test-*.jpg' --exclude 'assets/test-*.png' --exclude '*.md' \
  "$REPO_DIR/" "$STAGE/"

# ── 3. Deploy ───────────────────────────────────────────────────────────────
cd "$STAGE"
npx --yes wrangler@4 pages deploy . \
  --project-name "$PROJECT" \
  --branch main \
  --commit-dirty=true

echo
echo "Deployed. Verify:"
echo "  curl -sI https://${PROJECT}.pages.dev/ | head -1"
