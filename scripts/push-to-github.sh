#!/bin/bash
# One-time script to push Dimely code to GitHub.
# Run from the project root: bash scripts/push-to-github.sh
set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep GITHUB_TOKEN | xargs)
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN not found in .env"
  exit 1
fi

REPO="https://jumpstartupinfo-bit:${GITHUB_TOKEN}@github.com/jumpstartupinfo-bit/dimely.git"

git remote set-url origin "$REPO"

# Pull the GitHub README commit so histories can merge
git fetch origin main
git merge origin/main --allow-unrelated-histories -X ours -m "Merge remote README" --no-edit

# Push everything
git push origin main

# Remove token from remote URL for security
git remote set-url origin "https://github.com/jumpstartupinfo-bit/dimely.git"

echo ""
echo "✓ Pushed to https://github.com/jumpstartupinfo-bit/dimely"
