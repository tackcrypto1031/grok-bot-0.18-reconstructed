if (process.platform === "win32") await import("./package-windows.mjs");
else if (process.platform === "darwin") await import("./package-macos.mjs");
else throw new Error("Release packaging must run on Windows x64 or macOS arm64.");
