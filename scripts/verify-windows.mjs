import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { extractFile, listPackage } from "@electron/asar";
import { reconstructedName, windowsInstallerName, windowsOutputDir, windowsPortableDir, windowsZipName } from "./lib/config.mjs";
import { archiveLookupPath, normalizeArchivePath } from "./lib/asar-integrity.mjs";
function argumentValue(flag, fallback) { const index = process.argv.indexOf(flag); return index === -1 ? fallback : path.resolve(process.argv[index + 1]); }
const appDir = argumentValue("--dir", windowsPortableDir);
const executable = path.join(appDir, `${reconstructedName}.exe`);
const asarPath = path.join(appDir, "resources", "app.asar");
const unpacked = path.join(appDir, "resources", "app.asar.unpacked");
async function requirePath(target) { await access(target); return target; }
async function filePrefix(target, length = 2) { const handle = await open(target, "r"); try { const buffer = Buffer.alloc(length); await handle.read(buffer, 0, length, 0); return buffer; } finally { await handle.close(); } }
async function sha256File(target) { const hash = createHash("sha256"); for await (const chunk of createReadStream(target)) hash.update(chunk); return hash.digest("hex"); }
for (const required of [executable, asarPath,
  path.join(unpacked, "dist", "deps", "@anysphere", "tree-chunk-napi", "tree-chunk-napi.win32-x64-msvc.node"),
  path.join(unpacked, "dist", "deps", "better-sqlite3", "build", "Release", "better_sqlite3.node"),
  path.join(unpacked, "dist", "deps", "cursor-proclist", "build", "Release", "cursor_proclist.node"),
  path.join(unpacked, "dist", "deps", "tree-sitter", "build", "Release", "tree_sitter_runtime_binding.node"),
  path.join(unpacked, "dist", "deps", "tree-sitter-bash", "prebuilds", "win32-x64", "tree-sitter-bash.node"),
  path.join(unpacked, "dist", "deps", "whichlang-node-win32-x64-msvc", "whichlang-node.win32-x64-msvc.node"),
  path.join(unpacked, "dist", "node-deps", "tree-sitter", "build", "Release", "tree_sitter_runtime_binding.node"),
  path.join(unpacked, "dist", "node-deps", "tree-sitter-bash", "build", "Release", "tree_sitter_bash_binding.node"),
  path.join(unpacked, "dist", "native", "sand-webauthn-signer.exe")]) await requirePath(required);
const pe = await readFile(executable);
if (pe.toString("ascii", 0, 2) !== "MZ") throw new Error("Packaged executable is not a Windows PE file");
const peOffset = pe.readUInt32LE(0x3c);
if (pe.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0" || pe.readUInt16LE(peOffset + 4) !== 0x8664) throw new Error("Packaged executable is not PE32+ x64");
const listing = new Set(listPackage(asarPath).map(normalizeArchivePath));
for (const required of ["package.json", "dist/electron-main/main.cjs", "dist/host/host-main.cjs", "dist/renderer/index.html", "dist/reconstruction-build.json"]) if (!listing.has(required)) throw new Error(`Windows ASAR is missing ${required}`);
const packageJson = JSON.parse(extractFile(asarPath, archiveLookupPath("package.json")).toString("utf8"));
if (packageJson.name !== "grok-bot-018-reconstructed" || packageJson.productName !== reconstructedName) throw new Error("Windows ASAR does not use the isolated reconstructed product identity");
const electronMain = extractFile(asarPath, archiveLookupPath("dist/electron-main/main.cjs")).toString("utf8");
for (const marker of ["SAND_DISABLE_UPDATES", "GROK_BOT_RECONSTRUCTED_DATA_DIR", "Grok Bot 0.18 Reconstructed", "setPath(\"userData\"", "setPath(\"sessionData\"", "setPath(\"logs\"", "SAND_USER_DATA_DIR", "SAND_DATA_ROOT", "process.env.GROK_BOT_RECONSTRUCTED !== \"1\""]) if (!electronMain.includes(marker)) throw new Error(`Windows isolation/update guard is missing ${marker}`);
const manifest = JSON.parse(await readFile(path.join(unpacked, "dist", "deps", "runtime-deps-manifest.json"), "utf8"));
if (manifest.platform !== "win32" || manifest.arch !== "x64") throw new Error("Packaged native runtime manifest is not win32/x64");
if (!Array.isArray(manifest.resolutionClosure?.packages) || manifest.resolutionClosure.packages.length === 0) throw new Error("Packaged runtime resolution closure is missing");
for (const name of [windowsInstallerName, windowsZipName, "SHA256SUMS"]) await requirePath(path.join(windowsOutputDir, name));
if ((await filePrefix(path.join(windowsOutputDir, windowsInstallerName))).toString("ascii") !== "MZ") throw new Error("NSIS installer is not a Windows executable");
if ((await filePrefix(path.join(windowsOutputDir, windowsZipName))).toString("ascii") !== "PK") throw new Error("Portable artifact is not a ZIP archive");
const checksumLines = (await readFile(path.join(windowsOutputDir, "SHA256SUMS"), "utf8")).trim().split(/\r?\n/);
for (const line of checksumLines) { const match = /^([0-9a-f]{64})  (.+)$/.exec(line); if (!match) throw new Error(`Invalid checksum line: ${line}`); if (await sha256File(path.join(windowsOutputDir, match[2])) !== match[1]) throw new Error(`Checksum mismatch for ${match[2]}`); }
const runtimeFiles = await readdir(path.join(unpacked, "dist", "native"));
console.log(`Windows verification passed: PE32+ x64, isolated profile, ${runtimeFiles.length} native tools, NSIS and ZIP checksums valid.`);
