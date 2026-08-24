# Project Description

**Expbuilder** is a desktop app, [electronjs.org](https://electronjs.org)-based , for creating cognitive and behavioral experiments based on the [jspsych.org](https://www.jspsych.org) framework. It leverages free resources like [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) for self-hosting experiments, and GitHub Pages for external hosting, which is connected to a [serverless API](https://github.com/adndvlp/builder_api) to send the experiment results to the user’s Dropbox and/or Google Drive. Jspsych requires code for building experiments, so Expbuilder provides a user interface that translates your experiment design into the code required by Jspsych.

# Features

- Desktop platform based on Electron
- Uses GitHub Pages for free hosting
- **Jspsych** as the main engine for experiment creation
- **Cloudflare Tunnels** for sharing experiments via self-hosting
- Connection to a [serverless API](https://github.com/adndvlp/builder_api) (for free) for data capture and storage
- No coding required, but advanced users can extend functionality with it.

# Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/adndvlp/expbuilder.git
   cd expbuilder
   ```

2. Build the app for your OS:

   ```bash
   npm run build
   ```

   This installs all dependencies, builds the client, downloads the correct Cloudflare Tunnel binary for your OS and architecture, and packages the Electron app into `dist/`.

Requires Node.js 18 or newer.

# Cloudflare Tunnel Setup

The Cloudflare Tunnel binary is downloaded automatically into `server/cloudflared/` for your OS and architecture by `npm run build` (or `npm run fetch:cloudflared`). The version is pinned in `scripts/fetch-cloudflared.mjs` and can be overridden:

```bash
CLOUDFLARED_VERSION=2026.8.2 npm run fetch:cloudflared
```

To force a re-download of an existing binary: `npm run fetch:cloudflared -- --force`.

# Development

To run the application in development mode:

1. Start the client:

   ```bash
   cd client
   npm run dev
   ```

   The client will be available at **port 5173** (by default).

2. Start the server:
   ```bash
   npm run electron
   ```

Make sure both processes are running for full functionality.

# Build Instructions

From the root of the project:

```bash
npm run build
```

This will:

1. Install the root and client dependencies (`sharp` resolves automatically for your OS and architecture)
2. Build the client
3. Download the Cloudflare Tunnel binary for your OS and architecture
4. Run `electron-builder` for your CPU architecture

The installers are written to `dist/`.

# Releases and CI

Releases are built and published automatically with GitHub Actions (`.github/workflows/build.yml`):

| Trigger | Tests | Builds | Tag / Release |
| --- | --- | --- | --- |
| Feature branch commit with `[build]` in the message | Yes | Yes, installers as workflow artifacts | No |
| Feature branch commit without `[build]` | Yes | No | No |
| Push to `main` | Yes | Yes | Yes, creates the `v<version>` tag and publishes the release |
| Manual run (`workflow_dispatch`) | Yes | Yes | No |

The `[build]` flag is detected in any commit of the push, not only the last one.

Supported targets:

- macOS arm64 and x64 (`dmg`, `zip`)
- Windows x64 (`nsis`, `zip`)
- Linux x64 (`deb`, `rpm`) and arm64 (`deb`)

To publish a new release:

1. Bump the version locally (e.g. `npm version patch`), which updates `package.json` and the lockfile
2. Push to `main` — the workflow runs the tests, tags the new version, builds every OS on its native runner, and publishes the release

The workflow requires a `GH_TOKEN` secret (a personal access token with `repo` scope) to create the tag and publish the release.

# Usage

- **Development mode:** Access the client in your browser at [http://localhost:5173](http://localhost:5173).
- **Production mode:** Use the Electron-generated application (the executable) to run the platform locally.

# Contribution Guidelines

Contributions are welcome! Fork the repository and submit your pull request following the coding conventions and adding tests for new features.

# License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).
Commercial use is prohibited.

# Author

Developed by Andrés Pacheco Fabián under the guidance and supervision of Dr. Armando Quetzalcóatl Angulo Chavira from the Laboratory of Psycholinguistics at the Faculty of Psychology, UNAM.
[Laboratory website](https://www.labpsicolinguistica.psicol.unam.mx/contacto.html)
