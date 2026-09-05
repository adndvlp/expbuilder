import { describe, expect, it } from "vitest";
import {
  buildFirebaseConfig,
  parseCreatedAppId,
  parseLoginToken,
  parseLoginUrl,
  parseSdkConfig,
  projectSetupArgs,
} from "../../lib/backendSetup";

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

  it("builds project create args and skips the CLI for an existing project", () => {
    expect(projectSetupArgs("my-lab", "create")).toEqual([
      "projects:create",
      "my-lab",
      "--display-name",
      "my-lab",
    ]);
    expect(projectSetupArgs("test-e4cf9", "use")).toBeNull();
  });
});
