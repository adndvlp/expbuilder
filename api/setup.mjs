import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline/promises";

const API_DIR = path.dirname(fileURLToPath(import.meta.url));
process.chdir(API_DIR);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function run(command, args, { interactive = false } = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  if (interactive) {
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
    return "";
  }
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "").trim());
  return (result.stdout || "").trim();
}

async function promptHidden(label) {
  const stdout = process.stdout;
  stdout.write(`${label}: `);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (buf) => {
      for (const c of buf.toString("utf8")) {
        if (c === "\r" || c === "\n") {
          stdout.write("\n");
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          resolve(value.trim());
          return;
        }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f" || c === "\b") {
          value = value.slice(0, -1);
        } else {
          value += c;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  console.log("=== ExpBuilder self-hosted setup ===\n");

  let loggedIn = false;
  try {
    run("firebase", ["projects:list"]);
    loggedIn = true;
  } catch {
    console.log("First, log in to Firebase with your Google account.");
    run("firebase", ["login"], { interactive: true });
    loggedIn = true;
  }
  if (!loggedIn) return;

  const choice = (await rl.question("Create a new Firebase project (n) or use an existing one (e)? [n/e]: ")).trim().toLowerCase();
  let projectId;
  if (choice === "e") {
    projectId = (await rl.question("Existing Firebase project ID: ")).trim();
  } else {
    projectId = (await rl.question("New Firebase project ID (lowercase letters, numbers and dashes, e.g. expbuilder-mylab): ")).trim();
    run("firebase", ["projects:create", projectId], { interactive: true });
  }
  run("firebase", ["use", projectId]);

  console.log(`\nFirebase Functions require the Blaze plan (credit card). Usage stays within the free tier for light workloads.`);
  console.log(`Open https://console.firebase.google.com/project/${projectId}/settings/usage and upgrade to Blaze.`);
  await rl.question("Press Enter once you upgraded to Blaze...");

  try {
    run("firebase", ["firestore:databases:create", "(default)", "--location", "nam5"]);
  } catch (err) {
    console.log(`Could not create Firestore automatically: ${err.message}`);
    console.log(`Create it manually at https://console.firebase.google.com/project/${projectId}/firestore`);
    await rl.question("Press Enter once Firestore exists...");
  }

  let appId = null;
  let firebaseConfig = null;
  try {
    const appName = (await rl.question("Display name for the Firebase Web App [ExpBuilder]: ")).trim() || "ExpBuilder";
    const out = run("firebase", ["apps:create", "web", appName]);
    const match = out.match(/Created Firebase App\s+([^\s]+)/);
    appId = match ? match[1] : null;
    if (!appId) throw new Error("could not parse app id from apps:create output");
  } catch (err) {
    console.log(`Could not create the web app automatically: ${err.message}`);
    console.log(`Create it manually at https://console.firebase.google.com/project/${projectId}/settings/general`);
  }

  if (appId) {
    try {
      run("firebase", ["apps:sdkconfig", "web", appId, "-o", "sdkconfig.json"]);
      const sdk = JSON.parse(fs.readFileSync("sdkconfig.json", "utf8"));
      const client = sdk.client && sdk.client[0];
      firebaseConfig = {
        apiKey: client.api_key[0].current_key,
        authDomain: `${sdk.project_info.project_id}.firebaseapp.com`,
        projectId: sdk.project_info.project_id,
        storageBucket: sdk.project_info.storage_bucket,
        messagingSenderId: sdk.project_info.project_number,
        appId: client.client_info.mobilesdk_app_id,
      };
      fs.rmSync("sdkconfig.json", { force: true });
    } catch (err) {
      console.log(`Could not read the SDK config: ${err.message}`);
      firebaseConfig = null;
    }
  }

  console.log(`\nEnable Email/Password and Google in Firebase Auth:`);
  console.log(`https://console.firebase.google.com/project/${projectId}/authentication/providers`);
  await rl.question("Press Enter once both sign-in providers are enabled...");

  const providers = [
    {
      key: "GITHUB",
      name: "GitHub",
      console: "https://github.com/settings/developers",
      instructions: 'Create a new OAuth App with "Authorization callback URL" set to:',
      callback: "http://localhost:8888/callback",
    },
    {
      key: "DROPBOX",
      name: "Dropbox",
      console: "https://www.dropbox.com/developers/apps",
      instructions: 'Create an app and add this "Redirect URI":',
      callback: "http://localhost:8888/callback",
    },
    {
      key: "GOOGLE_DRIVE",
      name: "Google Drive",
      console: "https://console.cloud.google.com/apis/credentials",
      instructions: 'Create an OAuth client ID (Web application) with this "Authorized redirect URI":',
      callback: "http://localhost:8888/callback",
    },
    {
      key: "OSF",
      name: "OSF",
      console: "https://osf.io/settings/applications/",
      instructions: "Create an application with this callback URL:",
      callback: "http://localhost:8888/callback",
    },
  ];

  const env = {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_APP_BASE_URL: `https://${projectId}.firebaseapp.com`,
    OSF_OAUTH_CALLBACK_URL: `https://us-central1-${projectId}.cloudfunctions.net/osfOAuthCallback`,
    OSF_POST_AUTH_REDIRECT_URL: "http://localhost:8888/callback",
  };

  for (const p of providers) {
    const include = (await rl.question(`\nConfigure ${p.name} OAuth now? (y/n) [n]: `)).trim().toLowerCase() === "y";
    if (!include) continue;
    console.log(`${p.console}`);
    console.log(`${p.instructions} ${p.callback}`);
    const clientId = (await rl.question(`${p.name} Client ID: `)).trim();
    const clientSecret = await promptHidden(`${p.name} Client Secret`);
    env[`${p.key}_CLIENT_ID`] = clientId;
    env[`${p.key}_CLIENT_SECRET`] = clientSecret;
  }

  const envPath = path.join("functions", ".env");
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
        .split("\n")
        .filter((line) => line && !line.startsWith("#"))
        .reduce((acc, line) => {
          const [k, ...rest] = line.split("=");
          if (k) acc[k.trim()] = rest.join("=").trim();
          return acc;
        }, {})
    : {};
  const merged = { ...existing, ...env };
  fs.writeFileSync(envPath, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log(`\nWrote ${envPath}`);

  run("npm", ["install", "--prefix", "functions"]);

  console.log("\nDeploying Firestore rules and Cloud Functions (takes a few minutes)...");
  run("firebase", ["deploy", "--only", "firestore,functions"], { interactive: true });

  console.log("\n=== Setup complete ===");
  if (firebaseConfig) {
    console.log("Paste this JSON into the app (Settings > Firebase Credentials):\n");
    console.log(JSON.stringify(firebaseConfig, null, 2));
  } else {
    console.log(`Copy the web app config at https://console.firebase.google.com/project/${projectId}/settings/general and paste it into the app (Settings > Firebase Credentials).`);
  }
  console.log("\nThen restart the app, create your account from the sign-in screen, and connect your providers in Settings.");

  rl.close();
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
