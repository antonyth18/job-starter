# Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs the tests in test/
```

## What is here

- `server.js`: the web server. `GET /api/jobs?q=` lists jobs, `GET /` serves the page.
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `lib/saved.js`: the saved jobs store, backed by `saved.json`.
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Your task

See the work sample brief on insiderOne: add saved jobs (save, list, remove),
with tests, and add a short section to this README about what you built.

## Saved jobs

### What I built

Students can save jobs and come back to them later.

- Each job in the list has a **Save** button. Once a job is saved, its button
  reads **Saved** and is disabled.
- A **Saved jobs** list at the top of the page has a **Remove** button on each job.
- Saved jobs are kept in `saved.json` on the server, so they survive a page
  reload and a server restart. The file is created on the first save and is
  ignored by git.

The API:

| Request | Result |
| --- | --- |
| `GET /api/saved` | `200` and the saved jobs (full job objects), oldest first |
| `POST /api/saved` with `{ "jobId": "j1" }` | `201` and the job. `200` if it was already saved, and it still appears only once |
| `DELETE /api/saved/j1` | `204`. `404` if the job is not saved |

If something is wrong, the API returns a clear JSON error such as
`{ "error": "No job with id \"x\"" }` instead of crashing:
`404` for an unknown job id, and `400` for a missing or invalid body.

### Run it and the tests

```
npm start      # http://localhost:3000
npm test       # 18 tests
```

- `test/saved.test.js` tests the store: saving the same job twice, removing a job,
  surviving a restart, concurrent saves, and a corrupt file.
- `test/api.test.js` runs the real server on a random port with a temporary
  `saved.json` and tests every route, including the error cases.
  Your own `saved.json` is never touched.

### One decision: store job ids, not copies of jobs

`saved.json` holds only ids (`["j1", "j6"]`). `GET /api/saved` looks each id up
in `jobs.json` when the request comes in. So:

- If a job's stipend or title changes, the saved list shows the new details.
- If a job is removed from `jobs.json`, it drops out of the saved list
  instead of showing up blank or out of date.
- The file stays small and easy to read.

Two smaller choices protect the file. Changes are queued one after another,
so two saves at the same moment cannot overwrite each other. Each write goes
to a temporary file that is then renamed into place, so a crash cannot leave a
half-written file. A corrupt `saved.json` causes an error instead of being
silently reset to empty, so no one's saved jobs are lost without anyone
noticing.

### What I would do next

- **Saved lists per student.** At the moment everyone shares one list, which
  is fine for one student on their own machine. Next I would add login, or at
  least an anonymous id in a cookie, and key the saved jobs by user.
- **A real database such as SQLite** once there are several users or server
  processes. The in-process queue only protects a single server process.
- **Browser tests** (for example with Playwright) for the Save and Remove
  buttons. The page logic is small and tested by hand. Only the API and the
  store have automated tests.
- **Optimistic UI.** Update the buttons immediately and roll back if the
  request fails, instead of reloading both lists after each click.
