import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, chmod, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { path7za } from "7zip-bin";
import { archivedWindowsInstaller, cachedWindowsRuntime, windowsInstallerSha256, windowsUpstreamAsarSha256 } from "./lib/config.mjs";
import { run } from "./lib/process.mjs";
import { hydrateSourcePayloadFromWindowsRuntime, validateWindowsRuntime } from "./lib/runtime.mjs";

async function exists(target) { try { await access(target); return true; } catch { return false; } }
async function sha256(target) { const hash = createHash("sha256"); for await (const chunk of createReadStream(target)) hash.update(chunk); return hash.digest("hex"); }

if (!(await exists(archivedWindowsInstaller))) throw new Error(`Missing archived Windows installer: ${archivedWindowsInstaller}. Run git lfs pull.`);
const installerDigest = await sha256(archivedWindowsInstaller);
if (installerDigest !== windowsInstallerSha256) throw new Error(`Windows installer checksum mismatch: expected ${windowsInstallerSha256}, got ${installerDigest}`);
if (process.platform !== "win32") await chmod(path7za, 0o755);

if (!(await exists(cachedWindowsRuntime))) {
  const temporary = await mkdtemp(path.join(tmpdir(), "grok-bot-018-windows-"));
  try {
    await run(path7za, ["x", "-y", "-aoa", `-o${temporary}`, archivedWindowsInstaller]);
    const extractedAsar = path.join(temporary, "resources", "app.asar");
    if (!(await exists(extractedAsar))) throw new Error("The upstream NSIS installer did not contain resources/app.asar");
    if (await sha256(extractedAsar) !== windowsUpstreamAsarSha256) {
      await rm(extractedAsar, { force: true });
      await run(path7za, ["e", "-y", "-aoa", `-o${path.dirname(extractedAsar)}`, archivedWindowsInstaller, "resources/app.asar"]);
    }
    await rm(cachedWindowsRuntime, { recursive: true, force: true });
    await mkdir(path.dirname(cachedWindowsRuntime), { recursive: true });
    await cp(temporary, cachedWindowsRuntime, { recursive: true, dereference: false, preserveTimestamps: true });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
const runtime = await validateWindowsRuntime(cachedWindowsRuntime);
const hydrated = await hydrateSourcePayloadFromWindowsRuntime(runtime);
console.log(`Windows runtime ready: ${runtime}`);
console.log(`Checksum-pinned Windows source payload ready: ${hydrated.destination} (${hydrated.sha256})`);
