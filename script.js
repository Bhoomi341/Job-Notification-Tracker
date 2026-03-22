/**
 * Job Notification Tracker
 * Persists jobs in localStorage, supports CRUD, search, filter, and deadline alerts.
 */

const STORAGE_KEY = "jobNotificationTracker";

/** @typedef {{ id: string, company: string, role: string, link: string, status: 'applied' | 'not-applied', deadline: string }} Job */

// --- DOM refs ---
const jobForm = document.getElementById("jobForm");
const editIdInput = document.getElementById("editId");
const submitBtnText = document.getElementById("submitBtnText");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const companyInput = document.getElementById("company");
const roleInput = document.getElementById("role");
const linkInput = document.getElementById("link");
const statusInput = document.getElementById("status");
const deadlineInput = document.getElementById("deadline");

const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");
const clearAllBtn = document.getElementById("clearAllBtn");

const jobsTableBody = document.getElementById("jobsTableBody");
const cardsGrid = document.getElementById("cardsGrid");
const emptyState = document.getElementById("emptyState");
const tableWrap = document.getElementById("tableWrap");
const filteredCountEl = document.getElementById("filteredCount");

const statTotal = document.getElementById("statTotal");
const statApplied = document.getElementById("statApplied");
const statNotApplied = document.getElementById("statNotApplied");

const deadlineAlertPanel = document.getElementById("deadlineAlertPanel");
const deadlineAlertList = document.getElementById("deadlineAlertList");

// --- Date helpers (local calendar day) ---

/**
 * Parse YYYY-MM-DD as local midnight.
 * @param {string} ymd
 * @returns {Date}
 */
function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Today at local midnight.
 * @returns {Date}
 */
function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Difference in whole days from today to deadline (deadline - today).
 * @param {string} deadlineYmd
 * @returns {number}
 */
function daysUntilDeadline(deadlineYmd) {
  const today = startOfToday();
  const end = parseLocalDate(deadlineYmd);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

/**
 * @param {string} deadlineYmd
 * @returns {{ expired: boolean, withinTwoDays: boolean, daysLeft: number }}
 */
function deadlineInfo(deadlineYmd) {
  const daysLeft = daysUntilDeadline(deadlineYmd);
  return {
    expired: daysLeft < 0,
    withinTwoDays: daysLeft >= 0 && daysLeft <= 2,
    daysLeft,
  };
}

// --- Storage ---

/** @returns {Job[]} */
function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {Job[]} jobs */
function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

// --- Stats & alerts ---

/** @param {Job[]} allJobs */
function updateStats(allJobs) {
  const total = allJobs.length;
  const applied = allJobs.filter((j) => j.status === "applied").length;
  const notApplied = allJobs.filter((j) => j.status === "not-applied").length;
  statTotal.textContent = String(total);
  statApplied.textContent = String(applied);
  statNotApplied.textContent = String(notApplied);
}

/**
 * Show panel listing jobs whose deadline is within 2 days and not expired.
 * @param {Job[]} allJobs
 */
function renderDeadlineAlerts(allJobs) {
  const urgent = allJobs.filter((j) => {
    const info = deadlineInfo(j.deadline);
    return info.withinTwoDays && !info.expired;
  });

  deadlineAlertList.innerHTML = "";
  if (urgent.length === 0) {
    deadlineAlertPanel.hidden = true;
    return;
  }

  urgent.forEach((j) => {
    const info = deadlineInfo(j.deadline);
    const li = document.createElement("li");
    const dayWord = info.daysLeft === 0 ? "today" : info.daysLeft === 1 ? "in 1 day" : `in ${info.daysLeft} days`;
    li.textContent = `${j.company} — ${j.role} (deadline ${dayWord})`;
    deadlineAlertList.appendChild(li);
  });
  deadlineAlertPanel.hidden = false;
}

// --- Filter ---

/**
 * @param {Job[]} jobs
 * @param {string} query
 * @param {string} statusFilter
 * @returns {Job[]}
 */
function filterJobs(jobs, query, statusFilter) {
  const q = query.trim().toLowerCase();
  return jobs.filter((j) => {
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    if (!matchStatus) return false;
    if (!q) return true;
    const company = j.company.toLowerCase();
    const role = j.role.toLowerCase();
    return company.includes(q) || role.includes(q);
  });
}

// --- Row / card HTML ---

/**
 * @param {Job} job
 * @returns {HTMLElement}
 */
function buildTableRow(job) {
  const info = deadlineInfo(job.deadline);
  const tr = document.createElement("tr");

  let rowClass = job.status === "applied" ? "row-applied" : "row-not-applied";
  if (info.expired) rowClass += " row-expired";
  tr.className = rowClass;

  const statusLabel = job.status === "applied" ? "Applied" : "Not Applied";
  const badgeClass = job.status === "applied" ? "badge-applied" : "badge-not-applied";

  const deadlineDisplay = info.expired
    ? `<span class="deadline-cell"><time datetime="${job.deadline}">${formatDateDisplay(job.deadline)}</time> <span class="badge badge-expired">Expired</span></span>`
    : `<span class="deadline-cell"><time datetime="${job.deadline}">${formatDateDisplay(job.deadline)}</time>${
        info.withinTwoDays
          ? ` <span class="deadline-soon" title="Due soon">Due soon</span>`
          : ""
      }</span>`;

  tr.innerHTML = `
    <td>${escapeHtml(job.company)}</td>
    <td>${escapeHtml(job.role)}</td>
    <td><a class="link-app" href="${escapeAttr(job.link)}" target="_blank" rel="noopener noreferrer">Apply</a></td>
    <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
    <td>${deadlineDisplay}</td>
    <td class="cell-actions">
      <button type="button" class="btn btn-sm btn-edit" data-action="edit" data-id="${escapeAttr(job.id)}">Edit</button>
      <button type="button" class="btn btn-sm btn-delete" data-action="delete" data-id="${escapeAttr(job.id)}">Delete</button>
    </td>
  `;
  return tr;
}

/**
 * @param {Job} job
 * @returns {HTMLElement}
 */
function buildJobCard(job) {
  const info = deadlineInfo(job.deadline);
  const article = document.createElement("article");
  let cardClass = "job-card " + (job.status === "applied" ? "card-applied" : "card-not-applied");
  if (info.expired) cardClass += " card-expired";
  article.className = cardClass;

  const statusLabel = job.status === "applied" ? "Applied" : "Not Applied";
  const badgeClass = job.status === "applied" ? "badge-applied" : "badge-not-applied";

  const expiredHtml = info.expired
    ? ` <span class="badge badge-expired">Expired</span>`
    : "";
  const soonHtml =
    !info.expired && info.withinTwoDays ? ` <span class="deadline-soon">Due within 2 days</span>` : "";

  article.innerHTML = `
    <h3>${escapeHtml(job.company)}</h3>
    <p class="role">${escapeHtml(job.role)}</p>
    <dl class="job-card-meta">
      <div>
        <dt>Application</dt>
        <dd><a class="link-app" href="${escapeAttr(job.link)}" target="_blank" rel="noopener noreferrer">Open link</a></dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd><span class="badge ${badgeClass}">${statusLabel}</span></dd>
      </div>
      <div>
        <dt>Deadline</dt>
        <dd><time datetime="${escapeAttr(job.deadline)}">${formatDateDisplay(job.deadline)}</time>${expiredHtml}${soonHtml}</dd>
      </div>
    </dl>
    <div class="job-card-actions">
      <button type="button" class="btn btn-sm btn-edit" data-action="edit" data-id="${escapeAttr(job.id)}">Edit</button>
      <button type="button" class="btn btn-sm btn-delete" data-action="delete" data-id="${escapeAttr(job.id)}">Delete</button>
    </div>
  `;
  return article;
}

function formatDateDisplay(ymd) {
  const d = parseLocalDate(ymd);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

// --- Main render ---

function render() {
  const allJobs = loadJobs();
  updateStats(allJobs);
  renderDeadlineAlerts(allJobs);

  const filtered = filterJobs(allJobs, searchInput.value, filterStatus.value);

  jobsTableBody.innerHTML = "";
  cardsGrid.innerHTML = "";

  tableWrap.hidden = allJobs.length === 0;
  cardsGrid.hidden = allJobs.length === 0;

  if (filtered.length === 0) {
    emptyState.hidden = false;
    if (allJobs.length > 0) {
      tableWrap.style.opacity = "0.65";
    } else {
      tableWrap.style.opacity = "1";
    }
    filteredCountEl.textContent = allJobs.length === 0 ? "No jobs yet — add your first one above." : "0 jobs match filters.";
  } else {
    emptyState.hidden = true;
    tableWrap.style.opacity = "1";
    filtered.forEach((job) => {
      jobsTableBody.appendChild(buildTableRow(job));
      cardsGrid.appendChild(buildJobCard(job));
    });
    filteredCountEl.textContent = `Showing ${filtered.length} of ${allJobs.length} job${allJobs.length === 1 ? "" : "s"}`;
  }
}

// --- Form: add / update ---

function resetFormToAdd() {
  editIdInput.value = "";
  submitBtnText.textContent = "Add Job";
  cancelEditBtn.hidden = true;
  jobForm.reset();
}

jobForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!jobForm.checkValidity()) {
    jobForm.reportValidity();
    return;
  }

  const company = companyInput.value.trim();
  const role = roleInput.value.trim();
  const link = linkInput.value.trim();
  const linkLower = link.toLowerCase();
  if (!linkLower.startsWith("http://") && !linkLower.startsWith("https://")) {
    linkInput.setCustomValidity("Use a link starting with http:// or https://");
    linkInput.reportValidity();
    return;
  }
  linkInput.setCustomValidity("");
  /** @type {'applied' | 'not-applied'} */
  const status = statusInput.value;
  const deadline = deadlineInput.value;

  const jobs = loadJobs();
  const editingId = editIdInput.value.trim();

  if (editingId) {
    const idx = jobs.findIndex((j) => j.id === editingId);
    if (idx !== -1) {
      jobs[idx] = { ...jobs[idx], company, role, link, status, deadline };
      saveJobs(jobs);
    }
    resetFormToAdd();
  } else {
    const newJob = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      company,
      role,
      link,
      status,
      deadline,
    };
    jobs.push(newJob);
    saveJobs(jobs);
    jobForm.reset();
  }

  render();
});

cancelEditBtn.addEventListener("click", () => {
  resetFormToAdd();
});

// --- Edit / delete (delegation on document sections) ---

function handleListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (!id) return;

  const jobs = loadJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return;

  if (action === "delete") {
    if (!confirm(`Delete job at "${job.company}"?`)) return;
    saveJobs(jobs.filter((j) => j.id !== id));
    if (editIdInput.value === id) resetFormToAdd();
    render();
    return;
  }

  if (action === "edit") {
    editIdInput.value = job.id;
    companyInput.value = job.company;
    roleInput.value = job.role;
    linkInput.value = job.link;
    statusInput.value = job.status;
    deadlineInput.value = job.deadline;
    submitBtnText.textContent = "Update Job";
    cancelEditBtn.hidden = false;
    jobForm.scrollIntoView({ behavior: "smooth", block: "start" });
    companyInput.focus();
  }
}

jobsTableBody.addEventListener("click", handleListClick);
cardsGrid.addEventListener("click", handleListClick);

// --- Clear all ---

clearAllBtn.addEventListener("click", () => {
  const jobs = loadJobs();
  if (jobs.length === 0) {
    alert("There are no jobs to clear.");
    return;
  }
  if (
    !confirm(
      `This will permanently remove all ${jobs.length} job(s) from this browser. Continue?`
    )
  ) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  resetFormToAdd();
  render();
});

// --- Live search / filter ---

searchInput.addEventListener("input", () => render());
filterStatus.addEventListener("change", () => render());

// --- Init ---

render();
