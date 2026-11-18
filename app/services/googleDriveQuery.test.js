import test from "node:test";
import assert from "node:assert/strict";

import { escapeDriveQueryValue } from "./googleDriveQuery.js";

const cases = [
  ["ordinary name", "Jane Smith", "Jane Smith"],
  ["Kathleen O'Mara", "Kathleen O'Mara", String.raw`Kathleen O\'Mara`],
  ["O'Brien", "O'Brien", String.raw`O\'Brien`],
  ["backslash", String.raw`Jane\Smith`, String.raw`Jane\\Smith`],
  ["apostrophe + backslash", String.raw`O'Brien\Smith`, String.raw`O\'Brien\\Smith`],
];

for (const [label, name, expected] of cases) {
  test(`Drive query escaping: ${label}`, () => {
    assert.equal(escapeDriveQueryValue(name), expected);
  });
}
