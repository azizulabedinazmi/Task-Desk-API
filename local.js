import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handler } from "./api/handler.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const contentTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

async function serveStatic(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = join(fileURLToPath(new URL("./public/", import.meta.url)), requestedFile);
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Page not found" }));
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/") || ["/health", "/tasks"].some((path) => request.url.startsWith(path))) {
    await handler(request, response);
    return;
  }
  await serveStatic(request, response);
});

server.listen(port, host, () => console.log(`Task API listening at http://${host}:${port}`));