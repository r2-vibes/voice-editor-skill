#!/usr/bin/env node
// Voice Editor — Batch Find & Replace as Google Docs suggestions

const fs = require('node:fs');
const path = require('node:path');
const CDP = require('chrome-remote-interface');
const { readAndValidateEditsFile } = require('./preflight-lib');

const DEFAULT_EDITS_PATH = path.resolve(__dirname, '../tmp/edits.json');
const editsPath = process.env.EDITS_PATH || DEFAULT_EDITS_PATH;
const cdpPort = Number(process.env.CDP_PORT || 18800);
const docId = process.env.DOC_ID || '';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadEditsOrExit(filePath) {
  const result = readAndValidateEditsFile(filePath);
  if (!result.ok) {
    console.error(`Invalid edits file: ${filePath}`);
    for (const err of result.errors) console.error(` - ${err}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const edits = loadEditsOrExit(editsPath);

  const client = await CDP({
    port: cdpPort,
    target: targets =>
      targets.find(t => (docId ? t.url.includes(docId) : t.url.includes('docs.google.com/document'))),
  });

  const { Runtime, Input } = client;

  await Runtime.evaluate({
    expression: `
      (() => {
        const checkboxes = document.querySelectorAll('.docs-findandreplacedialog .jfk-checkbox');
        for (const cb of checkboxes) {
          if (cb.textContent.includes('Match case') && !cb.classList.contains('jfk-checkbox-checked')) {
            cb.click();
            return 'enabled match case';
          }
        }
        return 'match case already enabled or not found';
      })()
    `,
  });
  await sleep(300);

  async function typeInField(selector, text) {
    await Runtime.evaluate({
      expression: `
        (() => {
          const el = document.querySelector('${selector}');
          if (!el) return 'not found';
          el.focus();
          el.select();
          return 'focused';
        })()
      `,
    });
    await sleep(100);

    await Input.dispatchKeyEvent({ type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 4 });
    await Input.dispatchKeyEvent({ type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 4 });
    await sleep(50);

    for (const char of text) {
      if (char === '\n') {
        await Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter' });
        await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter' });
      } else {
        await Input.dispatchKeyEvent({ type: 'keyDown', key: char, text: char });
        await Input.dispatchKeyEvent({ type: 'keyUp', key: char });
      }
    }
  }

  async function pressEnter() {
    await Runtime.evaluate({
      expression: `document.querySelector('.docs-findandreplacedialog-findinput input').focus()`,
    });
    await sleep(100);
    await Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter' });
    await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter' });
  }

  async function clickReplaceAll() {
    const result = await Runtime.evaluate({
      expression: `
        (() => {
          const btns = document.querySelectorAll('.docs-findandreplacedialog [role=button]');
          for (const b of btns) {
            if (b.textContent.trim() === 'Replace all' && !b.classList.contains('jfk-button-disabled')) {
              b.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
              b.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true}));
              b.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
              return 'clicked';
            }
          }
          return 'disabled or not found';
        })()
      `,
    });
    return result.result.value;
  }

  async function getMatchCount() {
    const result = await Runtime.evaluate({
      expression: `
        (() => {
          const cells = document.querySelectorAll('.docs-findandreplacedialog td');
          for (const c of cells) {
            const text = c.textContent.trim();
            if (text.match(/\\d+ of \\d+/)) return text;
          }
          return '0 of 0';
        })()
      `,
    });
    return result.result.value;
  }

  console.log(`Starting batch edit: ${edits.length} edits (EDITS_PATH=${editsPath}, CDP_PORT=${cdpPort})`);
  const startTime = Date.now();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < edits.length; i++) {
    const [find, replace] = edits[i];
    const findClean = find.replace(/\n/g, ' ');
    const replaceClean = replace.replace(/\n/g, ' ');

    await typeInField('.docs-findandreplacedialog-findinput input', findClean);
    await sleep(500);

    await pressEnter();
    await sleep(1200);

    const count = await getMatchCount();
    if (count === '0 of 0') {
      console.log(`[${i + 1}/${edits.length}] SKIP (0 matches): ${find.substring(0, 60)}...`);
      failed++;
      continue;
    }

    await typeInField('.docs-findandreplacedialog .docs-findandreplacedialog-text', replaceClean);
    await sleep(500);

    const result = await clickReplaceAll();
    await sleep(1200);

    if (result === 'clicked') {
      console.log(`[${i + 1}/${edits.length}] OK: ${find.substring(0, 60)}...`);
      success++;
    } else {
      console.log(`[${i + 1}/${edits.length}] FAIL (${result}): ${find.substring(0, 60)}...`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! ${success} succeeded, ${failed} failed/skipped in ${elapsed}s`);
  await client.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
