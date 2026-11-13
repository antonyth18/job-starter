const list = document.getElementById("jobs");
const savedList = document.getElementById("saved");
const savedEmpty = document.getElementById("saved-empty");
const search = document.getElementById("search");
const errorBox = document.getElementById("error");

// Ids of the saved jobs, so each Save button knows whether it is already saved.
let savedIds = new Set();

function describe(job) {
  return `${job.title} at ${job.company}, ${job.location}. Rs ${job.stipend.toLocaleString("en-IN")} a month.`;
}

function jobItem(job, buttonLabel, onClick, disabled = false) {
  const li = document.createElement("li");
  const text = document.createElement("span");
  text.textContent = describe(job);
  const button = document.createElement("button");
  button.textContent = buttonLabel;
  button.disabled = disabled;
  button.setAttribute("aria-label", `${buttonLabel} ${job.title} at ${job.company}`);
  button.addEventListener("click", onClick);
  li.append(text, button);
  return li;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

async function showJobs(query = "") {
  const jobs = await api(`/api/jobs?q=${encodeURIComponent(query)}`);
  list.innerHTML = "";
  for (const job of jobs) {
    const isSaved = savedIds.has(job.id);
    list.append(jobItem(job, isSaved ? "Saved" : "Save", () => run(() => save(job.id)), isSaved));
  }
}

async function showSaved() {
  const saved = await api("/api/saved");
  savedIds = new Set(saved.map((j) => j.id));
  savedList.innerHTML = "";
  for (const job of saved) {
    savedList.append(jobItem(job, "Remove", () => run(() => remove(job.id))));
  }
  savedEmpty.hidden = saved.length > 0;
}

async function save(jobId) {
  await api("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  await refresh();
}

async function remove(jobId) {
  await api(`/api/saved/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  await refresh();
}

async function refresh() {
  await showSaved(); // First, so the job list knows which ones are saved.
  await showJobs(search.value);
}

/** Runs an action and shows any failure on the page instead of losing it. */
async function run(action) {
  try {
    showError("");
    await action();
  } catch (err) {
    showError(err.message);
  }
}

search.addEventListener("input", () => run(() => showJobs(search.value)));
run(refresh);
