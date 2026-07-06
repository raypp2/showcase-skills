// recap-template.test.mjs — static CSS assertions for the timeline section
// (`.tl-*` classes) in assets/recap-template.html. The Timeline section's
// HTML is entirely AI-authored per RECAP.md (generate-recap.mjs never
// touches it), so there's no generated output to exercise here — these
// checks instead guard the CSS invariants that fixed two real layout bugs:
//
// 1. .tl-heads and every .tl-row are separate, independent grid containers
//    (not CSS Subgrid), so they only stay column-aligned because both
//    declare the identical grid-template-columns string against the same
//    available width. Letting them drift apart again (e.g. someone tweaks
//    .tl-row's columns for a new content type without updating .tl-heads)
//    silently reintroduces the header/column misalignment bug.
// 2. .tl-card (and the .tl-left/.tl-right grid items it sits inside) needs
//    min-width: 0, or a card's automatic minimum width can exceed its grid
//    column and overflow the viewport instead of shrinking to fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'assets', 'recap-template.html'), 'utf8');

function ruleFor(selector) {
  // Matches "SELECTOR { ...declarations... }" — selectors in this file don't
  // nest, so a non-greedy match up to the first closing brace is enough.
  // Escaping the selector (not just its dots) keeps this safe for any CSS
  // metacharacter, and the exact-selector-then-brace shape means `.tl-row`
  // matches only its own standalone rule, not the compound `.tl-row.tl-gap-row`.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{([^}]*)\\}');
  const m = TEMPLATE.match(re);
  assert.ok(m, `expected to find a CSS rule for ${selector}`);
  return m[1];
}

test('.tl-heads and .tl-row declare the identical grid-template-columns', () => {
  const headsCols = ruleFor('.tl-heads').match(/grid-template-columns:\s*([^;]+);/);
  const rowCols = ruleFor('.tl-row').match(/grid-template-columns:\s*([^;]+);/);
  assert.ok(headsCols && rowCols, 'both .tl-heads and .tl-row should declare grid-template-columns');
  assert.equal(headsCols[1].trim(), rowCols[1].trim(), '.tl-heads and .tl-row must share the same column template or their columns can drift out of alignment');
});

test('the shared middle column is a fixed width, not `auto`', () => {
  const headsCols = ruleFor('.tl-heads').match(/grid-template-columns:\s*([^;]+);/)[1];
  assert.ok(!/\bauto\b/.test(headsCols), 'an `auto` middle column sizes independently per grid instance (empty header vs. a date badge vs. a gap dot), which is what caused the original misalignment');
});

test('.tl-card, .tl-left, and .tl-right all set min-width: 0 to allow shrinking', () => {
  for (const selector of ['.tl-card', '.tl-left', '.tl-right']) {
    assert.match(ruleFor(selector), /min-width:\s*0\b/, `${selector} should set min-width: 0`);
  }
});

test('.tl-mobile-legend exists, is hidden by default, and shown at the 560px breakpoint', () => {
  assert.match(TEMPLATE, /\.tl-mobile-legend\s*\{[^}]*display:\s*none/, '.tl-mobile-legend should be hidden above the mobile breakpoint');
  const mobileBlock = TEMPLATE.match(/@media \(max-width: 560px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobileBlock, 'expected a max-width: 560px media query');
  assert.match(mobileBlock[1], /\.tl-mobile-legend\s*\{[^}]*display:\s*flex/, '.tl-mobile-legend should switch to visible inside the mobile breakpoint');
  assert.match(mobileBlock[1], /\.tl-heads,\s*\.tl-rail\s*\{[^}]*display:\s*none/, 'the two-column header should still be hidden on mobile — the legend replaces it, not duplicates it');
});
