#!/usr/bin/env bash
set -euo pipefail

echo "⚡ Running KubeSmith CI validation pipeline..."
node dist/bin.js --version
echo "✔ KubeSmith executable verified."
