Builder_api is a Firebase project using serverless functions to authenticate users, receive experiment data, and send it to the user's own storage provider. Part of the expbuilder ecosystem: https://github.com/adndvlp/expbuilder

## Getting Started

**Note:** This backend is configured to work exclusively with expbuilder (https://github.com/adndvlp/expbuilder) and is not intended for standalone use.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/adndvlp/builder_api.git
   cd builder_api/builder_api
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Firebase:**

   - Create a Firebase project at https://console.firebase.google.com/
   - Create an environment file (e.g., `.env`) with your required variables (Firebase credentials, API keys, etc.).

4. **Deploy or run locally:**
   - For local development, use the Firebase emulator:
     ```bash
     firebase emulators:start --only functions
     ```
   - For deployment, use:
     ```bash
     firebase deploy --only functions
     ```

## Functions runtime

Cloud Functions uses Node.js 22, declared in `functions/package.json` and its lockfile. Functions CI and the local verification use Node.js 22. Node.js 20 was decommissioned on 2026-10-30 and cannot be redeployed. See the [official runtime schedule](https://docs.cloud.google.com/functions/docs/runtime-support) and [Firebase runtime upgrade instructions](https://firebase.google.com/docs/functions/manage-functions#upgrade_your_nodejs_runtime).

From the repository root, using Node.js 22, check the configured runtime without deploying:

```bash
node --test api/persistence-e2e/runtime.test.mjs
```

This invokes the installed Firebase CLI's runtime selection and support validator, and checks that the lockfile agrees with the deployed package. It reproduces the reported retirement cutoff and checks the current date. `npm run test:e2e:persistence` also runs this check before downloading SDKs or starting emulators. Passing it verifies runtime selection; it does not verify a remote deployment or the project's IAM permissions.

---

# Copyright

This project is based on DataPipe by Josh de Leeuw.

https://pipe.jspsych.org

de Leeuw, J. R. (2024). DataPipe: Born-open data collection for online experiments. _Behavior Research Methods, 56_(3), 2499-2506.
