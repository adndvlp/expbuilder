import http from "http";
import { URL } from "url";

/**
 * Creates a temporary local HTTP server to receive the OAuth callback
 * @param {number} port - Local port (e.g., 8888)
 * @param {number} timeout - Maximum wait time in ms (default: 5 minutes)
 * @returns {Promise<{code: string, state: string}>} - OAuth code and state
 */
export function createOAuthCallbackServer(port = 8888, timeout = 300000) {
  return new Promise((resolve, reject) => {
    let server;
    let timeoutId;

    // HTML response to display in the browser (colors matching the app)
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #3d92b4 0%, #3e6879 100%);
            }
            .container {
              background: #f8f9fa;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #d4af37;
            }
            h1 {
              color: #3d92b4;
              margin: 0 0 10px 0;
            }
            p {
              color: #333333;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Authentication Successful!</h1>
            <p>You can close this window and return to the app.</p>
          </div>
        </body>
      </html>
    `;

    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Authentication Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #d4af37 0%, #cf000b 100%);
            }
            .container {
              background: #f8f9fa;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #cf000b;
            }
            h1 {
              color: #cf000b;
              margin: 0 0 10px 0;
            }
            p {
              color: #333333;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Authentication Error</h1>
            <p>Please close this window and try again.</p>
          </div>
        </body>
      </html>
    `;

    // Create HTTP server
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      // Only accept requests to the /callback path
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        // Send response to the browser
        res.writeHead(200, { "Content-Type": "text/html" });

        if (error || !code) {
          res.end(errorHtml);
          cleanup();
          reject(new Error(error || "No code received"));
        } else {
          res.end(successHtml);
          cleanup();
          resolve({ code, state });
        }
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    // Function to clean up resources
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (server) {
        server.close();
      }
    };

    // Safety timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("OAuth callback timeout"));
    }, timeout);

    // Start server
    server.listen(port, () => {
      console.log(
        `OAuth callback server listening on http://localhost:${port}/callback`
      );
    });

    // Handle server errors
    server.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Checks if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}
