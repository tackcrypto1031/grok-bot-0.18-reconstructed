import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { cacheDir, reconstructedName, windowsPortableDir } from "./lib/config.mjs";
import { run } from "./lib/process.mjs";
if (process.platform !== "win32") throw new Error("The Windows launch smoke test must run on Windows.");
const profile = path.join(cacheDir, "windows-smoke-profile");
const executable = path.join(windowsPortableDir, `${reconstructedName}.exe`);
await rm(profile, { recursive: true, force: true });
const child = spawn(executable, ["--disable-gpu", "--no-sandbox"], { env: { ...process.env, GROK_BOT_RECONSTRUCTED_DATA_DIR: profile }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let capturedOutput = "";
function forward(stream, destination) {
  stream.on("data", chunk => {
    destination.write(chunk);
    capturedOutput = (capturedOutput + chunk.toString("utf8")).slice(-65_536);
  });
}
forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);
let earlyExit;
try {
  earlyExit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), 15_000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
} finally {
  if (child.pid != null) {
    const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    await run(taskkill, ["/PID", String(child.pid), "/T", "/F"]).catch(() => {});
  }
}
if (earlyExit != null) throw new Error(`Windows application exited during launch smoke test: ${JSON.stringify(earlyExit)}`);
if (/fatal composition failure/i.test(capturedOutput)) throw new Error("Windows application reported a fatal composition failure during launch smoke test");
console.log(`Windows launch smoke test passed: ${executable} remained alive for 15 seconds with an isolated profile.`);
