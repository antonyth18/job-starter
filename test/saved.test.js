import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSavedStore } from "../lib/saved.js";

async function tempStore(t) {
  const dir = await mkdtemp(join(tmpdir(), "saved-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "saved.json");
  return { path, store: createSavedStore(path) };
}

test("starts empty when there is no file yet", async (t) => {
  const { store } = await tempStore(t);
  assert.deepEqual(await store.list(), []);
});

test("adds ids in order and writes them to the file", async (t) => {
  const { path, store } = await tempStore(t);
  assert.equal(await store.add("j1"), true);
  assert.equal(await store.add("j3"), true);
  assert.deepEqual(await store.list(), ["j1", "j3"]);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), ["j1", "j3"]);
});

test("adding the same id twice keeps one copy", async (t) => {
  const { store } = await tempStore(t);
  await store.add("j1");
  assert.equal(await store.add("j1"), false);
  assert.deepEqual(await store.list(), ["j1"]);
});

test("removes an id, and says when it was not saved", async (t) => {
  const { store } = await tempStore(t);
  await store.add("j1");
  await store.add("j2");
  assert.equal(await store.remove("j1"), true);
  assert.deepEqual(await store.list(), ["j2"]);
  assert.equal(await store.remove("j1"), false);
});

test("a new store on the same file sees what was saved (survives a restart)", async (t) => {
  const { path, store } = await tempStore(t);
  await store.add("j5");
  assert.deepEqual(await createSavedStore(path).list(), ["j5"]);
});

test("changes made at the same time are not lost", async (t) => {
  const { store } = await tempStore(t);
  const ids = ["j1", "j2", "j3", "j4", "j5", "j6"];
  await Promise.all(ids.map((id) => store.add(id)));
  assert.deepEqual([...(await store.list())].sort(), ids);
});

test("a broken file is reported, not silently wiped", async (t) => {
  const { path, store } = await tempStore(t);
  await writeFile(path, "{ not json");
  await assert.rejects(store.add("j1"), SyntaxError);
  assert.equal(await readFile(path, "utf8"), "{ not json");
});
