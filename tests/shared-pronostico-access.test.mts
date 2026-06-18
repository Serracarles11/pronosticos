import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const proxySource = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../app/detalle/page.tsx", import.meta.url), "utf8");

test("shared pronostico detail stays public and renders the login gate for visitors", () => {
  const protectedPaths = proxySource.match(/const protectedPaths = \[(.*?)\];/s)?.[1] ?? "";

  assert.doesNotMatch(protectedPaths, /["']\/detalle["']/);
  assert.doesNotMatch(protectedPaths, /["']\/picks["']/);
  assert.match(detailSource, /if \(!user\) return <LockedPronosticoPreview id=\{id\} \/>/);
  assert.doesNotMatch(detailSource, /if \(!user\) redirect\(/);
});

test("detail share and auth actions preserve the pronostico URL", () => {
  assert.match(detailSource, /url=\{`\/detalle\?id=\$\{encodeURIComponent\(id\)\}`\}/);
  assert.match(detailSource, /\/auth\?next=\$\{encodedNext\}/);
  assert.match(detailSource, /\/auth\?tab=registro&next=\$\{encodedNext\}/);
});
