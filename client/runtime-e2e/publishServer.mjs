import { createServer } from "node:http";
import process from "node:process";
import { Buffer } from "node:buffer";

// Isolated replacement for the external publisher; never contacts GitHub/Firebase.
const artifacts = new Map();
const port = Number(process.env.RUNTIME_PUBLISH_PORT);
if (!port)
  throw new Error("Runtime publication tests require an allocated port");
const baseUrl = `http://127.0.0.1:${port}`;
const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/publishExperiment") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      artifacts.set(String(payload.experimentID), payload.htmlContent);
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          success: true,
          pagesUrl: `${baseUrl}/${payload.experimentID}`,
          repoUrl: baseUrl,
        }),
      );
      return;
    }
    if (request.url === "/") {
      response.end("Runtime publisher ready");
      return;
    }
    const html = artifacts.get(request.url?.slice(1));
    response.statusCode = html ? 200 : 404;
    response.setHeader("Content-Type", "text/html");
    response.end(html ?? "Artifact not found");
  } catch (error) {
    response.statusCode = 400;
    response.end(error.message);
  }
});
server.listen(port, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(() => process.exit()));
}
