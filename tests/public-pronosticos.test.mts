import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public pronostico zones only list unresolved picks", () => {
  const publicPages = [
    "app/feed/page.tsx",
    "app/pronosticos/page.tsx",
    "app/page.tsx",
  ];

  for (const path of publicPages) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /\.eq\("estado", "pendiente"\)/, path);
  }
});
