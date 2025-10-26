# Project Description

**expbuilder** is an Electron-based platform for creating scientific, educational, and student experiments. It leverages free resources like GitHub Pages, Cloudflare Tunnels (for sharing experiments via self-hosting), and low-cost Firebase for hosting and collecting results. **Jspsych** is used as the core engine for building and managing experiments, allowing anyone to create experiments without coding, except for advanced customizations. Everything is integrated into a single tool to support the community.

# Features

- Desktop platform based on Electron
- Uses GitHub Pages for free hosting
- **Jspsych** as the main engine for experiment creation
- **Cloudflare Tunnels** for sharing experiments via self-hosting
- Firebase for inexpensive data capture and storage
- No coding required for most experiments

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

3. From the root of the project, build the Electron app:
   ```bash
   npm run build:electron
   ```

This ensures all dependencies are installed before building the application.

# Usage

- **Development mode:** Access the client in your browser at [http://localhost:5173](http://localhost:5173).
- **Production mode:** Use the Electron-generated application (the executable) to run the platform locally.

Follow the on-screen instructions to create and manage your experiments.

# Contribution Guidelines

Contributions are welcome! Fork the repository and submit your pull request following the coding conventions and adding tests for new features.

# License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).
Commercial use is prohibited.

# Author

Developed by **adndvlp** under the guidance and supervision of the Laboratory of Psycholinguistics at the Faculty of Psychology, UNAM.
[Laboratory website](https://psicolinguistica.psicologia.unam.mx)