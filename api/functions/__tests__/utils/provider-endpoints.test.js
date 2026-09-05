import { jest } from "@jest/globals";

describe("provider-endpoints", () => {
  test("resolves the documented production URLs by default", async () => {
    const { PROVIDER_ENDPOINTS } = await import(
      "../../utils/provider-endpoints.js"
    );

    expect(PROVIDER_ENDPOINTS.github).toEqual({
      apiBase: "https://api.github.com",
      tokenUrl: "https://github.com/login/oauth/access_token",
    });
    expect(PROVIDER_ENDPOINTS.dropbox).toEqual({
      apiBase: "https://api.dropboxapi.com",
      contentBase: "https://content.dropboxapi.com",
      tokenUrl: "https://api.dropbox.com/oauth2/token",
    });
    expect(PROVIDER_ENDPOINTS.googleDrive).toEqual({
      apiBase: "https://www.googleapis.com",
      tokenUrl: "https://oauth2.googleapis.com/token",
    });
    expect(PROVIDER_ENDPOINTS.osf).toEqual({
      apiBase: "https://api.osf.io",
      tokenUrl: "https://accounts.osf.io/oauth2/token",
      authorizeUrl: "https://accounts.osf.io/oauth2/authorize",
    });
  });

  test("overrides endpoints via env vars and trims trailing slashes", async () => {
    process.env.GITHUB_API_BASE = "http://127.0.0.1:4010/";
    process.env.DROPBOX_CONTENT_BASE = "http://127.0.0.1:4011";
    process.env.GOOGLE_OAUTH_TOKEN_URL = "http://127.0.0.1:4012/token/";
    process.env.OSF_TOKEN_URL = "http://127.0.0.1:4013";

    jest.resetModules();
    const { PROVIDER_ENDPOINTS } = await import(
      "../../utils/provider-endpoints.js"
    );

    expect(PROVIDER_ENDPOINTS.github.apiBase).toBe("http://127.0.0.1:4010");
    expect(PROVIDER_ENDPOINTS.github.tokenUrl).toBe(
      "https://github.com/login/oauth/access_token",
    );
    expect(PROVIDER_ENDPOINTS.dropbox.contentBase).toBe("http://127.0.0.1:4011");
    expect(PROVIDER_ENDPOINTS.googleDrive.tokenUrl).toBe(
      "http://127.0.0.1:4012/token",
    );
    expect(PROVIDER_ENDPOINTS.osf.tokenUrl).toBe("http://127.0.0.1:4013");

    delete process.env.GITHUB_API_BASE;
    delete process.env.DROPBOX_CONTENT_BASE;
    delete process.env.GOOGLE_OAUTH_TOKEN_URL;
    delete process.env.OSF_TOKEN_URL;
    jest.resetModules();
  });
});
