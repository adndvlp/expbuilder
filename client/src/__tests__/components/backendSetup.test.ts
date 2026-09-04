import { describe, expect, it } from "vitest";
import { publishingSummary, setupStatus } from "../../lib/backendCopy";
import {
  buildFirebaseConfig,
  buildFunctionsEnv,
  buildOauthConfig,
  commandError,
  functionsDeployOnly,
  parseCreatedAppId,
  publishingFingerprint,
  parseLoginToken,
  parseLoginUrl,
  oauthStateFromConfig,
  parseFirebaseJsonResult,
  parseListedWebAppId,
  parseSdkConfig,
  projectSetupArgs,
  sanitizeBackendLog,
  type BackendOAuthState,
} from "../../lib/backendSetup";

const EMPTY: BackendOAuthState = {
  github: { enabled: false, clientId: "", clientSecret: "" },
  dropbox: { enabled: false, clientId: "", clientSecret: "" },
  googleDrive: { enabled: false, clientId: "", clientSecret: "" },
  osf: { enabled: false, clientId: "", clientSecret: "" },
};

function sdkJson() {
  return {
    project_info: {
      project_number: "123456",
      project_id: "my-proj",
      storage_bucket: "my-proj.appspot.com",
    },
    client: [
      {
        client_info: { mobilesdk_app_id: "1:123456:web:abcd" },
        api_key: [{ current_key: "api-key-xyz" }],
      },
    ],
  };
}

describe("backendSetup helpers", () => {
  it("parses the login:ci URL and refresh token from CLI output", () => {
    expect(
      parseLoginUrl(
        "Visit this URL to log in:\n\nhttps://accounts.google.com/authorize/abc\n\nWaiting for authentication...",
      ),
    ).toBe("https://accounts.google.com/authorize/abc");
    expect(parseLoginUrl("no url here")).toBeNull();

    expect(
      parseLoginToken(
        "Success! Use this token to login on a CI server:\n\n1//xyzABC-123\n\nExample: firebase deploy",
      ),
    ).toBe("1//xyzABC-123");
    expect(parseLoginToken("login failed")).toBeNull();
  });

  it("parses created web app ids and sdk configs", () => {
    expect(parseCreatedAppId("Created Firebase App 1:123:web:abc")).toBe(
      "1:123:web:abc",
    );
    expect(
      parseCreatedAppId(
        [
          "🎉🎉🎉 Your Firebase WEB App is ready! 🎉🎉🎉",
          "App information:",
          "  - App ID: 1:414213417080:web:285e5fc5e2fbebd656e58d",
          "  - Display name: ExpBuilder",
          "  firebase apps:sdkconfig WEB 1:414213417080:web:285e5fc5e2fbebd656e58d",
        ].join("\n"),
      ),
    ).toBe("1:414213417080:web:285e5fc5e2fbebd656e58d");
    expect(
      parseCreatedAppId(
        '  firebase apps:sdkconfig WEB 1:414213417080:web:285e5fc5e2fbebd656e58d',
      ),
    ).toBe("1:414213417080:web:285e5fc5e2fbebd656e58d");
    expect(parseCreatedAppId('{"appId":"1:9:web:deadbeef"}')).toBe(
      "1:9:web:deadbeef",
    );
    expect(parseCreatedAppId("something else")).toBeNull();

    const wrapped = `---\n${JSON.stringify(sdkJson())}\n---`;
    expect(parseSdkConfig(wrapped)).toEqual(sdkJson());
    expect(parseSdkConfig("no braces")).toBeNull();
    expect(parseSdkConfig("}{")).toBeNull();
    expect(parseSdkConfig("{ not json }")).toBeNull();
  });

  it("builds the firebase config from an sdk config", () => {
    expect(buildFirebaseConfig(sdkJson())).toEqual({
      apiKey: "api-key-xyz",
      authDomain: "my-proj.firebaseapp.com",
      projectId: "my-proj",
      storageBucket: "my-proj.appspot.com",
      messagingSenderId: "123456",
      appId: "1:123456:web:abcd",
    });
    expect(
      buildFirebaseConfig({
        apiKey: "js-key",
        authDomain: "my-proj.firebaseapp.com",
        projectId: "my-proj",
        storageBucket: "my-proj.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123456:web:abcd",
      }),
    ).toEqual({
      apiKey: "js-key",
      authDomain: "my-proj.firebaseapp.com",
      projectId: "my-proj",
      storageBucket: "my-proj.appspot.com",
      messagingSenderId: "123456",
      appId: "1:123456:web:abcd",
    });
    expect(
      buildFirebaseConfig({
        apiKey: "js-key",
        projectId: "my-proj",
        appId: "1:999:web:abcd",
      }),
    ).toEqual({
      apiKey: "js-key",
      authDomain: "my-proj.firebaseapp.com",
      projectId: "my-proj",
      storageBucket: "my-proj.appspot.com",
      messagingSenderId: "999",
      appId: "1:999:web:abcd",
    });
    expect(buildFirebaseConfig({ apiKey: "k", appId: "plain", projectId: "p" })).toBeNull();
    expect(buildFirebaseConfig(null)).toBeNull();
    expect(buildFirebaseConfig({ client: [{}] })).toBeNull();
    expect(
      buildFirebaseConfig({
        project_info: { project_id: "p", storage_bucket: "b", project_number: "1" },
        client: [{ client_info: {}, api_key: [{ current_key: "k" }] }],
      }),
    ).toBeNull();
    expect(
      buildFirebaseConfig({
        project_info: { storage_bucket: "b", project_number: "1" },
        client: [{ client_info: { mobilesdk_app_id: "app" }, api_key: [{ current_key: "k" }] }],
      }),
    ).toBeNull();
  });

  it("builds functions env including only enabled providers with full credentials", () => {
    const oauth: BackendOAuthState = {
      ...EMPTY,
      github: { enabled: true, clientId: "gh-id", clientSecret: "gh-secret" },
      dropbox: { enabled: true, clientId: "db-id", clientSecret: "" },
      googleDrive: { enabled: false, clientId: "drive-id", clientSecret: "drive-secret" },
      osf: { enabled: true, clientId: "", clientSecret: "osf-secret" },
    };

    expect(buildFunctionsEnv("my-proj", oauth)).toEqual({
      OSF_OAUTH_CALLBACK_URL:
        "https://us-central1-my-proj.cloudfunctions.net/osfOAuthCallback",
      OSF_POST_AUTH_REDIRECT_URL: "http://localhost:8888/callback",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
    });
  });

  it("builds oauth config with only enabled provider client ids", () => {
    const oauth: BackendOAuthState = {
      ...EMPTY,
      github: { enabled: true, clientId: "gh-id", clientSecret: "" },
      dropbox: { enabled: true, clientId: "", clientSecret: "" },
      googleDrive: { enabled: false, clientId: "drive-id", clientSecret: "" },
      osf: { enabled: true, clientId: "osf-id", clientSecret: "" },
    };

    expect(buildOauthConfig(oauth)).toEqual({
      githubClientId: "gh-id",
      osfClientId: "osf-id",
    });
  });

  it("builds oauth config for every enabled provider", () => {
    const oauth: BackendOAuthState = {
      github: { enabled: true, clientId: "gh-id", clientSecret: "" },
      dropbox: { enabled: true, clientId: "db-id", clientSecret: "" },
      googleDrive: { enabled: true, clientId: "drive-id", clientSecret: "" },
      osf: { enabled: true, clientId: "osf-id", clientSecret: "" },
    };

    expect(buildOauthConfig(oauth)).toEqual({
      githubClientId: "gh-id",
      dropboxClientId: "db-id",
      googleDriveClientId: "drive-id",
      osfClientId: "osf-id",
    });
  });

  it("parses listed web app ids and publishing leftovers", () => {
    expect(
      parseListedWebAppId("│ ExpBuilder │ 1:414:web:abc │ WEB │"),
    ).toBe("1:414:web:abc");
    expect(
      parseListedWebAppId(
        JSON.stringify({
          status: "success",
          result: [{ displayName: "Other", appId: "1:1:web:old" }, { displayName: "ExpBuilder", appId: "1:2:web:new" }],
        }),
      ),
    ).toBe("1:2:web:new");
    expect(parseListedWebAppId("no apps")).toBeNull();
    expect(parseFirebaseJsonResult('noise {"status":"success","result":[1]}')).toEqual([1]);
    expect(parseFirebaseJsonResult('{"status":"error"}')).toBeNull();

    expect(setupStatus({
      deployed: false,
      running: false,
      firestoreDone: true,
      billingDone: true,
      configSaved: true,
      token: "t",
      projectId: "lab",
    })).toBe("Server is ready to deploy.");
    expect(publishingSummary(EMPTY)).toContain("Publishing is not set up yet");
    expect(
      publishingSummary({
        ...EMPTY,
        github: { enabled: true, clientId: "gh", clientSecret: "" },
      }),
    ).toContain("Still to set up");
    expect(
      oauthStateFromConfig({ githubClientId: "gh-id" }).github,
    ).toEqual({ enabled: true, clientId: "gh-id", clientSecret: "" });
  });

  it("builds project create args and skips the CLI for an existing project", () => {
    expect(projectSetupArgs("my-lab", "create")).toEqual([
      "projects:create",
      "my-lab",
      "--display-name",
      "my-lab",
    ]);
    expect(projectSetupArgs("test-e4cf9", "use")).toBeNull();
  });

  it("prefers CLI Error lines when the process has no spawn error", () => {
    expect(
      commandError(
        { error: "spawn failed", output: "Error: ignored" },
        "fallback",
      ),
    ).toBe("spawn failed");
    expect(
      commandError(
        { error: null, output: "Warning: x\nError: project not found\n" },
        "fallback",
      ),
    ).toBe("project not found");
    expect(commandError({ error: null, output: "nope" }, "fallback")).toBe(
      "fallback",
    );
    expect(
      commandError(
        {
          error: null,
          output:
            "Error: An unexpected error has occurred.\nError: Cannot find module 'firebase-functions'\n",
        },
        "fallback",
      ),
    ).toBe("Cannot find module 'firebase-functions'");
    expect(
      commandError(
        {
          error: null,
          output:
            "Quota exceeded for total allowable CPU per project per region.\nError: Failed to update function apiData\n",
        },
        "fallback",
      ),
    ).toMatch(/ran out of CPU/);
    expect(functionsDeployOnly(false)).toBe("firestore,functions");
    expect(functionsDeployOnly(true)).toBe("functions");
    expect(
      publishingFingerprint({
        ...EMPTY,
        github: { enabled: true, clientId: "gh", clientSecret: "s" },
      }),
    ).not.toBe(publishingFingerprint(EMPTY));
  });

  it("strips CLI noise and redacts CI tokens from backend logs", () => {
    const raw = [
      "\u001B[33m\u001B[1m⚠ \u001B[22m\u001B[39m Authenticating with a `login:ci` token is deprecated and will be removed in a future major version of `firebase-tools`. Instead, use a service account key with `GOOGLE_APPLICATION_CREDENTIALS`: https://example.com",
      "(node:1) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.",
      "(Use `ExpBuilder --trace-deprecation ...` to show where the warning was created)",
      "Visit this URL on this device to log in:",
      "https://accounts.google.com/o/oauth2/auth?x=1",
      "Success! Use this token to login on a CI server:",
      "1//secret-token-value",
      'Example: firebase deploy --token "$FIREBASE_TOKEN"',
    ].join("\n");

    const cleaned = sanitizeBackendLog(raw);
    expect(cleaned).toContain("Visit this URL on this device to log in:");
    expect(cleaned).toContain("https://accounts.google.com/o/oauth2/auth?x=1");
    expect(cleaned).toContain("[redacted]");
    expect(cleaned).not.toContain("1//secret-token-value");
    expect(cleaned).not.toContain("punycode");
    expect(cleaned).not.toContain("login:ci");
    expect(cleaned).not.toContain("FIREBASE_TOKEN");
    expect(cleaned).not.toMatch(/\u001B/);
  });
});
