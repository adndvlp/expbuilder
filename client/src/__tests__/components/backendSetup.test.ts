import { describe, expect, it } from "vitest";
import {
  buildFirebaseConfig,
  buildFunctionsEnv,
  buildOauthConfig,
  parseCreatedAppId,
  parseLoginToken,
  parseLoginUrl,
  parseSdkConfig,
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
      FIREBASE_PROJECT_ID: "my-proj",
      FIREBASE_APP_BASE_URL: "https://my-proj.firebaseapp.com",
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
});
