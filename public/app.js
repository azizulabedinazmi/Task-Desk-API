const state = { tasks: [], filter: "all", search: "" };
const taskList = document.querySelector("#task-list");
const formMessage = document.querySelector("#form-message");

document.querySelector("#today").textContent = new Intl.DateTimeFormat("en", {
  weekday: "long", month: "short", day: "numeric", year: "numeric"
}).format(new Date());

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}

function visibleTasks() {
  return state.tasks.filter((task) => {
    const matchesFilter = state.filter === "all" || (state.filter === "completed" ? task.completed : !task.completed);
    return matchesFilter && task.title.toLowerCase().includes(state.search.toLowerCase());
  });
}

function render() {
  const open = state.tasks.filter((task) => !task.completed).length;
  document.querySelector("#total-count").textContent = state.tasks.length;
  document.querySelector("#open-count").textContent = open;
  document.querySelector("#done-count").textContent = state.tasks.length - open;
  const tasks = visibleTasks();

  if (!tasks.length) {
    taskList.innerHTML = `<div class="empty-state"><span class="empty-icon">${state.tasks.length ? "⌕" : "✦"}</span><h3>${state.tasks.length ? "Nothing matches" : "Your queue is clear"}</h3><p>${state.tasks.length ? "Try a different filter or search term." : "Add one small, concrete task to get moving."}</p></div>`;
    return;
  }

  taskList.innerHTML = tasks.map((task) => `
    <article class="task-item ${task.completed ? "is-complete" : ""}">
      <button class="check-button" data-toggle="${task.id}" type="button" aria-label="Mark ${escapeHtml(task.title)} ${task.completed ? "open" : "complete"}" aria-pressed="${task.completed}">${task.completed ? "✓" : ""}</button>
      <div class="task-content"><h3>${escapeHtml(task.title)}</h3><time datetime="${task.createdAt}">${formatTime(task.createdAt)}</time></div>
      <button class="delete-button" data-delete="${task.id}" type="button" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button>
    </article>`).join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

async function loadTasks() {
  const result = await request("/tasks");
  state.tasks = result.data;
  render();
}

document.querySelector("#task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.title;
  try {
    await request("/tasks", { method: "POST", body: JSON.stringify({ title: input.value }) });
    input.value = "";
    formMessage.textContent = "Task added to the queue.";
    await loadTasks();
  } catch (error) { formMessage.textContent = error.message; }
});

document.querySelector(".filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

document.querySelector("#search-input").addEventListener("input", (event) => { state.search = event.target.value; render(); });
document.querySelector("#refresh-button").addEventListener("click", loadTasks);

taskList.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-toggle]");
  const deletion = event.target.closest("[data-delete]");
  try {
    if (toggle) {
      const task = state.tasks.find((item) => item.id === toggle.dataset.toggle);
      await request(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ completed: !task.completed }) });
    }
    if (deletion) await request(`/tasks/${deletion.dataset.delete}`, { method: "DELETE" });
    if (toggle || deletion) await loadTasks();
  } catch (error) { formMessage.textContent = error.message; }
});

request("/health").then(() => { document.querySelector("#service-status").innerHTML = '<span class="status-dot live"></span>Service online'; }).catch(() => { document.querySelector("#service-status").innerHTML = '<span class="status-dot offline"></span>Service offline'; });
loadTasks().catch((error) => { taskList.innerHTML = `<div class="empty-state"><h3>Could not load tasks</h3><p>${escapeHtml(error.message)}</p></div>`; });