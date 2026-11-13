// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findJob, loadJobs, searchJobs } from "./lib/jobs.js";
import { createSavedStore } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 10_000;

/** Reads a small JSON request body. Returns undefined if it is missing, too big or not JSON. */
async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** `savedPath` lets tests use their own file instead of saved.json. */
export function createApp({ savedPath } = {}) {
  const saved = createSavedStore(savedPath);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs();
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }
      if (req.method === "GET" && url.pathname === "/api/saved") {
        const jobs = await loadJobs();
        // Ids of jobs no longer in jobs.json are skipped rather than shown as blanks.
        const savedJobs = (await saved.list()).map((id) => findJob(jobs, id)).filter(Boolean);
        return sendJson(res, 200, savedJobs);
      }
      if (req.method === "POST" && url.pathname === "/api/saved") {
        const body = await readJsonBody(req);
        const jobId = body?.jobId;
        if (typeof jobId !== "string" || !jobId) {
          return sendJson(res, 400, { error: 'Send JSON like { "jobId": "j1" }' });
        }
        const job = findJob(await loadJobs(), jobId);
        if (!job) return sendJson(res, 404, { error: `No job with id "${jobId}"` });
        const added = await saved.add(jobId);
        // 201 the first time, 200 if it was already saved: either way it is saved once.
        return sendJson(res, added ? 201 : 200, job);
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/saved/")) {
        let jobId;
        try {
          jobId = decodeURIComponent(url.pathname.slice("/api/saved/".length));
        } catch {
          return sendJson(res, 400, { error: "Bad job id in the URL" });
        }
        const removed = await saved.remove(jobId);
        if (!removed) return sendJson(res, 404, { error: `Job "${jobId}" is not saved` });
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
