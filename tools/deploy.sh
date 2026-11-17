#!/usr/bin/env bash
# Deploy the kit to Cloudflare Pages (project: tenten-kit → https://tenten-kit.pages.dev).
# Needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in the environment (or CF_ACCOUNT_ID / CF_API_TOKEN in ../easymath/.env).
# Stages a clean copy outside the repo (no node_modules / .git / zips), so wrangler never writes config into this folder.
set -euo pipefail
cd "$(dirname "$0")/.."
envval() { grep -E "^$1=" ../easymath/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$(envval CF_ACCOUNT_ID)}"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$(envval CF_API_TOKEN)}"
node tools/build.mjs
OUT="$(mktemp -d)/tenten-kit"
rsync -a --exclude node_modules --exclude .git --exclude '*.zip' --exclude package-lock.json ./ "$OUT/"
(cd "$(dirname "$OUT")" && npx -y wrangler@4 pages deploy "$OUT" --project-name tenten-kit --branch main --commit-dirty=true)
