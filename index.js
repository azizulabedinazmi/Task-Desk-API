import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handler } from "./api/handler.js";

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
		response.writeHead(200, { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
		response.end(file);
	} catch {
		response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
		response.end(JSON.stringify({ error: "Page not found" }));
	}
}

export default async function application(request, response) {
	if (request.url.startsWith("/api/")) {
		await handler(request, response);
		return;
	}
	await serveStatic(request, response);
}