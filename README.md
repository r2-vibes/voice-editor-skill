# Voice Editor

Train an assistant on your writing voice, then apply edits in Google Docs as **tracked suggestions**.

## What this does

- Learns your writing patterns from samples
- Rewrites paragraphs in your style
- Applies changes in Google Docs as suggestions (accept/reject)
- Supports inline editorial comments

## What you need

- Node.js 18+
- `gog` CLI authenticated
- Google Doc open in Chrome
- Chrome remote debugging enabled (default port `18800`)
- An edits file (`edits.json`) containing pairs of:
  - original text
  - rewritten text

Example `edits.json`:

```json
[
  ["old paragraph text", "new paragraph text"],
  ["another old paragraph", "another rewrite"]
]
```

## Quick start (5 steps)

1. Install script deps:

```bash
cd skills/voice-editor/scripts
npm install
```

2. Save edits JSON (default path):

```bash
mkdir -p ../tmp
# save to: skills/voice-editor/tmp/edits.json
```

3. Open your Google Doc in Chrome and switch to **Suggesting** mode.

4. Open **Find and replace** (`Cmd+Shift+H`).

5. Run preflight, then run batch apply:

```bash
DOC_ID=<google_doc_id> npm run preflight
DOC_ID=<google_doc_id> npm run batch-suggest
```

## Optional env vars

- `EDITS_PATH` (default: `skills/voice-editor/tmp/edits.json`)
- `CDP_PORT` (default: `18800`)

Example:

```bash
DOC_ID=<id> EDITS_PATH=/path/to/edits.json CDP_PORT=18800 npm run preflight -- --strict
```

## How to know it worked

- Terminal shows `OK`/`SKIP` per edit
- Final line shows success/fail count
- In Google Docs, changes appear as tracked suggestions

## Common issues

- **CDP connection failed**
  - Relaunch Chrome with remote debugging on the same port.
- **No matches found**
  - Find text must match exactly (including punctuation/case when Match case is enabled).
- **Doc not ready**
  - Ensure Suggesting mode + Find and replace dialog are open.

## FAQ (quick)

**Do I need coding skills?**
- Not really. If you can run 2 commands and copy a doc ID, you can use this.

**Will this edit my doc directly?**
- It applies edits as tracked suggestions, so you can accept/reject each one.

**Can I test safely first?**
- Yes. Use the demo file at `skills/voice-editor/tmp/edits.demo.json`.

**How do I set it up fastest?**
```bash
cd skills/voice-editor/scripts
./bootstrap.sh
```

## Privacy

- No credentials are stored in this repo.
- Scripts only act on the doc tab you have open.
