# Contributing

This repository is intended for a small technical study group. Keep changes
reviewable and do not commit generated application payloads or local evidence.

Before sharing a change, run:

```sh
npm ci
npm run check
npm run frontend:build
```

On macOS, after `npm run bootstrap`, package changes should also pass:

```sh
npm run package
npm run verify
```

On Windows x64, install Visual Studio 2022 Build Tools with the C++ desktop
workload, then run:

```powershell
npm run bootstrap
npm run package:windows
npm run smoke:windows
npm run verify:windows
```

Do not cross-publish a Windows release from Linux or macOS: the Node native
parser modules must be compiled and tested against the Windows ABI.

Use focused commits. Explain whether a change affects reviewed runtime source,
the editable frontend, the checksum-pinned packaged renderer, or packaging only.
Do not weaken checksum, bundle identity, code-signing, or clean-export checks to
make a build pass.
