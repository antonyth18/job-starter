import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";

/** Starts the app on a free port with its own empty saved file. */
async function startApp(t) {
  const dir = await mkdtemp(join(tmpdir(), "api-"));
  const savedPath = join(dir, "saved.json");
  const server = createApp({ savedPath });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://localhost:${server.address().port}`;
  return {
    savedPath,
    get: (path) => fetch(base + path),
    post: (path, body) =>
      fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    del: (path) => fetch(base + path, { method: "DELETE" }),
  };
}

const ids = async (res) => (await res.json()).map((j) => j.id);

test("GET /api/saved is empty at first", async (t) => {
  const app = await startApp(t);
  const res = await app.get("/api/saved");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("POST saves a job and GET returns the full job", async (t) => {
  const app = await startApp(t);
  const res = await app.post("/api/saved", { jobId: "j2" });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).company, "Kite Learning");

  const saved = await (await app.get("/api/saved")).json();
  assert.deepEqual(saved, [
    { id: "j2", title: "Frontend Developer Intern", company: "Kite Learning", location: "Pune", stipend: 15000 },
  ]);
});

test("saving the same job twice keeps one copy", async (t) => {
  const app = await startApp(t);
  assert.equal((await app.post("/api/saved", { jobId: "j1" })).status, 201);
  assert.equal((await app.post("/api/saved", { jobId: "j1" })).status, 200);
  assert.deepEqual(await ids(await app.get("/api/saved")), ["j1"]);
});

test("an unknown job id gets a clear 404, and nothing is saved", async (t) => {
  const app = await startApp(t);
  const res = await app.post("/api/saved", { jobId: "nope" });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /No job with id "nope"/);
  assert.deepEqual(await ids(await app.get("/api/saved")), []);
});

test("a bad body gets a clear 400", async (t) => {
  const app = await startApp(t);
  for (const body of ["not json", {}, { jobId: 42 }, { jobId: "" }, "null"]) {
    const res = await app.post("/api/saved", body);
    assert.equal(res.status, 400, `body ${JSON.stringify(body)}`);
    assert.ok((await res.json()).error);
  }
});

test("DELETE removes a saved job", async (t) => {
  const app = await startApp(t);
  await app.post("/api/saved", { jobId: "j1" });
  await app.post("/api/saved", { jobId: "j4" });
  const res = await app.del("/api/saved/j1");
  assert.equal(res.status, 204);
  assert.deepEqual(await ids(await app.get("/api/saved")), ["j4"]);
});

test("DELETE of a job that is not saved gets a 404", async (t) => {
  const app = await startApp(t);
  const res = await app.del("/api/saved/j1");
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /not saved/);
  assert.equal((await app.del("/api/saved/%E0")).status, 400);
});

test("saved jobs survive a server restart", async (t) => {
  const app = await startApp(t);
  await app.post("/api/saved", { jobId: "j3" });

  const restarted = createApp({ savedPath: app.savedPath });
  await new Promise((resolve) => restarted.listen(0, resolve));
  t.after(() => new Promise((resolve) => restarted.close(resolve)));
  const res = await fetch(`http://localhost:${restarted.address().port}/api/saved`);
  assert.deepEqual(await ids(res), ["j3"]);
});
