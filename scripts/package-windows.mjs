import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { packager } from "@electron/packager";
import { Arch, Platform, build as buildInstaller } from "electron-builder";
import pngToIco from "png-to-ico";
import { buildFidelityReconstructedAsar } from "./clean-build.mjs";
import { buildDir, reconstructedName, reconstructedWindowsAppId, repoRoot, windowsInstallerName, windowsOutputDir, windowsPortableDir, windowsZipName } from "./lib/config.mjs";

if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Windows releases must be built on Windows x64 so Node native modules use the correct ABI.");
const shellInput = path.join(buildDir, "windows-shell-input");
const shellOutput = path.join(buildDir, "windows-shell-output");
const icoPath = path.join(buildDir, "windows", "grok-bot-reconstructed.ico");
await rm(windowsOutputDir, { recursive: true, force: true });
await mkdir(windowsOutputDir, { recursive: true });
const { builtAsar, builtAsarUnpacked } = await buildFidelityReconstructedAsar();
await rm(shellInput, { recursive: true, force: true });
await mkdir(shellInput, { recursive: true });
await writeFile(path.join(shellInput, "package.json"), `${JSON.stringify({ name: "grok-bot-018-reconstructed-shell", productName: reconstructedName, version: "0.18.0-reconstructed.1", main: "main.js" }, null, 2)}\n`);
await writeFile(path.join(shellInput, "main.js"), "require('electron').app.quit();\n");
const iconPath = path.join(repoRoot, "src", "app", "dist", "renderer", "assets", "app-icon-C7NKj2u7.png");
await mkdir(path.dirname(icoPath), { recursive: true });
await writeFile(icoPath, await pngToIco(iconPath));
await rm(shellOutput, { recursive: true, force: true });
const packaged = await packager({ dir: shellInput, out: shellOutput, name: reconstructedName, platform: "win32", arch: "x64", electronVersion: "42.1.0", icon: icoPath, overwrite: true, prune: false, appVersion: "0.18.0-reconstructed.1", win32metadata: { CompanyName: "TackCrypto", FileDescription: reconstructedName, InternalName: "grok-bot-018-reconstructed", OriginalFilename: "Grok Bot 0.18 Reconstructed.exe", ProductName: reconstructedName } });
if (packaged.length !== 1) throw new Error(`Expected one packaged Windows directory, received ${packaged.length}`);
const packagedDir = packaged[0];
const resources = path.join(packagedDir, "resources");
await rm(path.join(resources, "app"), { recursive: true, force: true });
await cp(builtAsar, path.join(resources, "app.asar"));
await cp(builtAsarUnpacked, path.join(resources, "app.asar.unpacked"), { recursive: true, dereference: false, preserveTimestamps: true });
const artifacts = await buildInstaller({ publish: "never", prepackaged: packagedDir, targets: Platform.WINDOWS.createTarget(["nsis", "zip"], Arch.x64), config: { appId: reconstructedWindowsAppId, productName: reconstructedName, artifactName: "Grok-Bot-0.18-Reconstructed-${version}-${arch}.${ext}", directories: { output: windowsOutputDir }, win: { icon: icoPath, target: ["nsis", "zip"], verifyUpdateCodeSignature: false }, nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: reconstructedName, uninstallDisplayName: reconstructedName, deleteAppDataOnUninstall: false } } });
for (const artifact of artifacts) {
  if (artifact.endsWith(".exe")) await rename(artifact, path.join(windowsOutputDir, windowsInstallerName));
  else if (artifact.endsWith(".zip")) await rename(artifact, path.join(windowsOutputDir, windowsZipName));
}
await cp(packagedDir, windowsPortableDir, { recursive: true, dereference: false, preserveTimestamps: true });
async function sha256(target) { const hash = createHash("sha256"); for await (const chunk of createReadStream(target)) hash.update(chunk); return hash.digest("hex"); }
const releaseFiles = (await readdir(windowsOutputDir, { withFileTypes: true })).filter(entry => entry.isFile() && (entry.name.endsWith(".exe") || entry.name.endsWith(".zip"))).map(entry => entry.name).sort();
const checksums = [];
for (const name of releaseFiles) checksums.push(`${await sha256(path.join(windowsOutputDir, name))}  ${name}`);
await writeFile(path.join(windowsOutputDir, "SHA256SUMS"), `${checksums.join("\n")}\n`);
console.log(`Windows portable application: ${windowsPortableDir}`);
console.log(`Windows installer: ${path.join(windowsOutputDir, windowsInstallerName)}`);
console.log(`Windows ZIP: ${path.join(windowsOutputDir, windowsZipName)}`);
