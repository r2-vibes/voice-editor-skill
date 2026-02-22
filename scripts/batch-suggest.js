// Voice Editor — Batch Find & Replace as Suggestions in Google Docs
// 
// Usage: DOC_ID=<google_doc_id> node batch-suggest.js
// 
// Prerequisites:
//   1. Chrome open to the doc in Suggesting mode
//   2. Find & Replace dialog open (Edit → Find and replace)
//   3. /tmp/edits.json exists with [[find_text, replace_text], ...] pairs
//   4. npm install chrome-remote-interface (in working directory)
//
// Each edit creates a proper inline suggestion (tracked change) attributed
// to the signed-in Google account.

const edits = require('/tmp/edits.json');
const CDP = require('chrome-remote-interface');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const docId = process.env.DOC_ID || '';
  
  const client = await CDP({ port: 18800, target: (targets) => {
    return targets.find(t => docId ? t.url.includes(docId) : t.url.includes('docs.google.com/document'));
  }});
  
  const { Runtime, Input } = client;

  // Enable Match case checkbox if not already enabled
  await Runtime.evaluate({ expression: `
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
  `});
  await sleep(300);

  async function typeInField(selector, text) {
    await Runtime.evaluate({ expression: `
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) return 'not found';
        el.focus();
        el.select();
        return 'focused';
      })()
    `});
    await sleep(100);
    
    // Select all (Cmd+A)
    await Input.dispatchKeyEvent({ type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 4 });
    await Input.dispatchKeyEvent({ type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 4 });
    await sleep(50);
    
    // Type text character by character
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
    await Runtime.evaluate({ expression: `document.querySelector('.docs-findandreplacedialog-findinput input').focus()` });
    await sleep(100);
    await Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter' });
    await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter' });
  }
  
  async function clickReplaceAll() {
    const result = await Runtime.evaluate({ expression: `
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
    `});
    return result.result.value;
  }
  
  async function getMatchCount() {
    const result = await Runtime.evaluate({ expression: `
      (() => {
        const cells = document.querySelectorAll('.docs-findandreplacedialog td');
        for (const c of cells) {
          const text = c.textContent.trim();
          if (text.match(/\\d+ of \\d+/)) return text;
        }
        return '0 of 0';
      })()
    `});
    return result.result.value;
  }
  
  console.log(`Starting batch edit: ${edits.length} edits`);
  const startTime = Date.now();
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < edits.length; i++) {
    const [find, replace] = edits[i];
    
    // F&R can't match across newlines — replace with spaces
    const findClean = find.replace(/\n/g, ' ');
    const replaceClean = replace.replace(/\n/g, ' ');
    
    await typeInField('.docs-findandreplacedialog-findinput input', findClean);
    await sleep(500);
    
    await pressEnter();
    await sleep(1200);
    
    let count = await getMatchCount();
    
    if (count === '0 of 0') {
      console.log(`[${i+1}/${edits.length}] SKIP (0 matches): ${find.substring(0, 60)}...`);
      failed++;
      continue;
    }
    
    await typeInField('.docs-findandreplacedialog .docs-findandreplacedialog-text', replaceClean);
    await sleep(500);
    
    const result = await clickReplaceAll();
    await sleep(1200);
    
    if (result === 'clicked') {
      console.log(`[${i+1}/${edits.length}] OK: ${find.substring(0, 60)}...`);
      success++;
    } else {
      console.log(`[${i+1}/${edits.length}] FAIL (${result}): ${find.substring(0, 60)}...`);
      failed++;
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! ${success} succeeded, ${failed} failed/skipped in ${elapsed}s`);
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
