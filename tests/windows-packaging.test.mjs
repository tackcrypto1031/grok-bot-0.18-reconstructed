import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { reconstructedUpdaterGuard } from "../scripts/lib/build-asar.mjs";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFile(path.join(repoRoot, relative), "utf8");
test("Windows release inputs are checksum pinned", async () => {
  const config = await read("scripts/lib/config.mjs");
  assert.match(config, /464079a15ef5fa8b61ccea8fffcc78f63cfcf6df65fb0ad5e725d8b95f7e437e/);
  assert.match(config, /38e85c0e5042c0257db7925e1e55709d6d155d90d92fe26ad654127d509766e0/);
  assert.match(await read("scripts/bootstrap-windows-runtime.mjs"), /validateWindowsRuntime/);
});
test("Windows builds use an isolated identity and profile", async () => {
  for (const marker of [/GROK_BOT_RECONSTRUCTED_DATA_DIR/, /Grok Bot 0\.18 Reconstructed/, /setPath\(\"userData\"/, /setPath\(\"sessionData\"/, /setPath\(\"logs\"/, /SAND_USER_DATA_DIR/, /SAND_DATA_ROOT/]) assert.match(reconstructedUpdaterGuard, marker);
  const packaging = await read("scripts/package-windows.mjs");
  assert.match(packaging, /reconstructedWindowsAppId/);
  assert.match(packaging, /uninstallDisplayName/);
  assert.match(packaging, /Windows releases must be built on Windows x64/);
  const nodeRuntimeBuild = await read("scripts/build-tree-sitter-node.mjs");
  assert.match(nodeRuntimeBuild, /"node-gyp", "bin", "node-gyp\.js"/);
  assert.doesNotMatch(nodeRuntimeBuild, /node-gyp\.cmd/);
  assert.match(nodeRuntimeBuild, /enable_lto=false/);
  assert.match(nodeRuntimeBuild, /enable_thin_lto=false/);
  assert.match(nodeRuntimeBuild, /npm_config_enable_lto = "false"/);
  assert.match(nodeRuntimeBuild, /npm_config_enable_thin_lto = "false"/);
});
test("Windows CI produces, launches, and verifies NSIS and ZIP artifacts", async () => {
  const workflow = await read(".github/workflows/windows-release.yml");
  for (const marker of [/runs-on: windows-latest/, /npm run bootstrap/, /npm run package:windows/, /npm run smoke:windows/, /npm run verify:windows/, /Grok-Bot-0\.18-Reconstructed-Setup-x64\.exe/, /Grok-Bot-0\.18-Reconstructed-Portable-x64\.zip/]) assert.match(workflow, marker);
});
