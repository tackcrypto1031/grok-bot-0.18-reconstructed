if (process.platform === "win32") await import("./verify-windows.mjs");
else if (process.platform === "darwin") await import("./verify.mjs");
else throw new Error("Packaged application verification must run on Windows or macOS.");
