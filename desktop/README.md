# Pixel Key desktop

Electron desktop client for Windows, macOS and Linux. It generates the same backup
profile as the Android app and offline manual page. All account operations stay
on the computer and talk directly to Google.

## Run

Use Node.js 24 (minimum 22.13):

```sh
npm ci
npm ci --prefix desktop
npm run desktop
```

The home screen mirrors the app: pick the backup model, then either sign in with
Google or open manual configuration. The model applies to both. Sign-in and
verification happen in Google's own window, which shows the current host in its
title; closing it returns to the home screen. Manual configuration accepts a
pasted auth request or the individual fields and works offline. Scan the result
with the backup client, or copy it when it does not fit in a QR code.

## Credential lifecycle

- Google sign-in runs in its own non-persistent session without a preload or
  local application bridge. Navigations are restricted to account pages; only
  Google's account-page resources are allowed. Popups and downloads are blocked.
- Authentication requests use a separate in-memory Chromium session to respect
  system proxy settings. The shared transport fixes the Google endpoints and
  headers, omits cookies, rejects redirects, bounds responses, and supports
  cancellation and a 30-second timeout.
- Credentials are not intentionally persisted. Chromium's auxiliary data uses a
  temporary directory that is removed on normal exit. A forced termination may
  leave that directory behind; application memory and OS swap are not secure
  storage guarantees.
- Completing, cancelling, minimizing, locking (macOS and Windows), suspending, or
  leaving the app idle for five minutes clears sensitive state and aborts
  requests. Losing focus covers the interface so switching windows does not
  discard a result.
- The copy button clears its clipboard export after 60 seconds or at completion,
  provided another application has not replaced it. Manual selection/copy and
  clipboard history or synchronization are outside this cleanup mechanism.
- Screen capture protection is requested from the OS; support varies by platform.
  No credentials are included in application logs or error details.

## Verify

```sh
npm test
npm run typecheck
npm --prefix desktop run typecheck
npm --prefix desktop test
npm --prefix desktop run test:smoke
```

Smoke tests launch real Electron windows with fake Google pages and fake tokens.
They verify profile parity, native request headers, isolation, clipboard ownership,
cookie cleanup, cancellation and lifecycle behavior. They do not prove that
Google currently accepts a real account's desktop sign-in.

## Build

```sh
npm --prefix desktop run package
npm --prefix desktop run dist -- --publish never
node desktop/hash-release.mjs
```

Build on the target OS. Outputs are in `desktop/release/`: macOS DMGs for arm64 and
x64, Windows x64 installer, Linux x64 deb. macOS builds are ad-hoc
signed (`identity: "-"`) and not notarized; never let the build pick up a personal
signing certificate.

Packaged apps disable Node environment injection, Node inspection, the Node-only
launch mode and extra file-protocol privileges, and enable ASAR integrity checks.
The build-time `@electron/get` override uses the fixed downloader version shared
with Electron; it removes the legacy proxy logger's vulnerable dependency. Node
24 and the packaging checks are required when changing this override.

## Release

The Desktop workflow builds and tests on macOS, Windows and Linux on every push and
pull request. When a push to `main` carries a `desktop/package.json` version that has no
`desktop-v<version>` release yet, it publishes one with the DMGs, the installer, the
deb and their SHA-256 files. To release, bump the version and push.

## Structure

`src/controller.ts` owns export state, cancellation, and clipboard cleanup.
`src/login.ts` owns the Google window and cookie cleanup. `src/main.ts` exposes
only narrowly defined, sender-validated IPC methods. `src/preload.ts` bridges
those methods into the local UI. `src/index.html` and `src/renderer.ts` hold the
interface (home, model picker, manual configuration, result) and use shared
validation and QR logic; `build.mjs` adds the offline manual page's styles and
enforces a restrictive CSP. The mobile and offline-web entry points are unchanged.
