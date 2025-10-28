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

2. Install dependencies for both client and server:
   ```bash
   cd client
   npm install
   cd ../server
   npm install
   cd ..
   ```

# Cloudflare Tunnel Setup

- Add a folder named `cloudflared` inside the `server` directory.
- Place the Cloudflare Tunnel binary ([Download here](https://github.com/cloudflare/cloudflared/releases)) for your operating system and CPU architecture inside this folder.

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
   cd server
   node api.js
   ```

Make sure both processes are running for full functionality.

# Build Instructions

To create a production build of the app:

2. Build the client:

   ```bash
   cd client
   npm run build
   ```

3. Specify the correct architecture (`arch`) in the root `package.json` file to ensure compatibility with your system.

4. From the root of the project, build the Electron app:
   ```bash
   npm run build:electron
   ```

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
