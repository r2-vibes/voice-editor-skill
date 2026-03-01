#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$SKILL_DIR/tmp"

mkdir -p "$TMP_DIR"

cd "$SCRIPT_DIR"
npm install

if [[ ! -f "$TMP_DIR/edits.demo.json" ]]; then
  cat > "$TMP_DIR/edits.demo.json" <<'JSON'
[
  ["This is a rough draft paragraph.", "This is a polished draft paragraph with clearer language."],
  ["We should maybe consider this option.", "We should consider this option because it directly supports the goal."]
]
JSON
fi

echo "Bootstrap complete."
echo "- Dependencies installed"
echo "- Demo edits file: $TMP_DIR/edits.demo.json"
echo "Next: DOC_ID=<google_doc_id> EDITS_PATH=$TMP_DIR/edits.demo.json npm run preflight"
