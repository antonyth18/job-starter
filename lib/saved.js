// Saved jobs, kept as a list of job ids in a JSON file on the server.
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const DEFAULT_SAVED_PATH = new URL("../saved.json", import.meta.url);

/**
 * A store for saved job ids, backed by one JSON file.
 * Only ids are stored; the job details always come from jobs.json, so they never go stale.
 */
export function createSavedStore(path = DEFAULT_SAVED_PATH) {
  const file = path instanceof URL ? fileURLToPath(path) : path;
  // Every change waits for the one before it, so two requests at once cannot
  // both read the old list and overwrite each other's change.
  let queue = Promise.resolve();

  async function readIds() {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return []; // Nothing saved yet.
      throw err; // A broken file is an error; we do not silently wipe it.
    }
  }

  async function writeIds(ids) {
    // Write to a temp file, then rename, so a crash mid-write cannot leave half a file.
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(ids, null, 2) + "\n");
    await rename(tmp, file);
  }

  function change(fn) {
    const result = queue.then(async () => {
      const ids = await readIds();
      const next = fn(ids);
      if (next !== ids) await writeIds(next);
      return next !== ids;
    });
    queue = result.catch(() => {}); // One failed change must not block the next.
    return result;
  }

  return {
    /** The saved ids, oldest first. */
    async list() {
      await queue;
      return readIds();
    },
    /** Saves an id. Resolves to false if it was already saved. */
    add(id) {
      return change((ids) => (ids.includes(id) ? ids : [...ids, id]));
    },
    /** Removes an id. Resolves to false if it was not saved. */
    remove(id) {
      return change((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids));
    },
  };
}
