import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
export const tasks = new Map();

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body ? JSON.parse(request.body) : {};
  }

  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validateTaskInput(input) {
  if (!input || typeof input.title !== "string" || input.title.trim().length === 0) {
    return "title is required and must be a non-empty string";
  }
  if (input.title.trim().length > 120) {
    return "title must be 120 characters or fewer";
  }
  return null;
}

export async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  const taskId = pathname.match(/^\/tasks\/([^/]+)$/)?.[1];

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && pathname === "/tasks") {
    sendJson(response, 200, { data: [...tasks.values()] });
    return;
  }

  if (request.method === "POST" && pathname === "/tasks") {
    try {
      const input = await readJson(request);
      const validationError = validateTaskInput(input);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const task = {
        id: randomUUID(),
        title: input.title.trim(),
        completed: input.completed ?? false,
        createdAt: new Date().toISOString()
      };
      if (typeof task.completed !== "boolean") {
        sendJson(response, 400, { error: "completed must be a boolean" });
        return;
      }
      tasks.set(task.id, task);
      sendJson(response, 201, { data: task });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (taskId && request.method === "PATCH") {
    const task = tasks.get(taskId);
    if (!task) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }

    try {
      const input = await readJson(request);
      if (typeof input.completed !== "boolean") {
        sendJson(response, 400, { error: "completed must be a boolean" });
        return;
      }
      task.completed = input.completed;
      sendJson(response, 200, { data: task });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (taskId && request.method === "DELETE") {
    if (!tasks.delete(taskId)) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && taskId) {
    const task = tasks.get(taskId);
    if (!task) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }
    sendJson(response, 200, { data: task });
    return;
  }

  sendJson(response, 404, { error: "Route not found" });
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

async function serveStatic(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = join(fileURLToPath(new URL("./public/", import.meta.url)), requestedFile);

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream"
    });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "Page not found" });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/") || ["/health", "/tasks"].some((path) => request.url.startsWith(path))) {
    await handler(request, response);
    return;
  }
  await serveStatic(request, response);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, host, () => {
    console.log(`Task API listening at http://${host}:${port}`);
  });
}