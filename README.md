# Project Description

The expbuilder project is an Electron-based platform designed for creating experiments. It leverages free resources like GitHub Pages, CDN (Jspsych), Cloudflare tunnels, and low-cost Firebase for hosting and collecting results. This platform is tailored for the scientific, educational, and student community, enabling experiment creation without the need for extensive coding (except for customizations), integrating all necessary tools into one cohesive environment.

# Features
- Electron-based platform for easy experimentation
- Utilizes GitHub Pages for hosting
- Integrates CDN (Jspsych) for experiment management
- Cloudflare tunnels for secure connections
- Low-cost Firebase for data collection and hosting
- No coding required for basic experiments

# Installation
Follow these steps to set up the project:
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
   ```

# Development
To run the client and server, use the following commands:

1. Start the client:
   ```bash
   cd client && npm run dev
   ```
2. Start the server:
   ```bash
   cd server && node api.js
   ```

# Build Instructions
To build the project for production, run the following commands:
```bash
cd client
npm run build
```  

# Usage
Once the server and client are running, access the application via your web browser. Follow the on-screen instructions to create and manage experiments.

# Contribution Guidelines
Contributions are welcome! Please fork the repository and submit a pull request with your improvements. Ensure to follow the coding standards and add tests for new features.

# License
This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0). Commercial use is prohibited.

# Author
This project is maintained by the adndvlp team. We welcome collaboration from everyone interested in enhancing this platform!