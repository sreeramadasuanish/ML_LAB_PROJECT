"use strict";

const API = "/api";
const PALETTE = ["#E69F00", "#56B4E9", "#CC79A7", "#0072B2", "#F0E442", "#009E73", "#D55E00", "#666666"];
const state = { screen: "home", categories: [], file: null, uploadBusy: false, insightsMonth: "" };
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function readableDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  return parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : value;
}

function formatMonth(value) {
  if (!value) return "No transaction month";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric"
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const raw = await response.text();
  let body = null;
  if (raw) {
    try { body = JSON.parse(raw); }
    catch { body = { message: raw }; }
  }
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body;
}

function announce(message, isError = false) {
  const notice = $("#notice");
  notice.textContent = message;
  notice.classList.toggle("is-error", isError);
  notice.hidden = !message;
  if (message) window.setTimeout(() => { if (notice.textContent === message) notice.hidden = true; }, 6000);
}

function setScreen(screen) {
  state.screen = screen;
  $$(".screen").forEach(section => {
    const visible = section.id === `${screen}-screen`;
    section.hidden = !visible;
    section.classList.toggle("is-visible", visible);
  });
  $$(".nav-link").forEach(button => {
    const active = button.dataset.screen === screen;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#current-section").textContent = ({
    home: "Home", upload: "Upload", review: "Review queue",
    history: "Transaction history", insights: "Insights", budgets: "Budgets"
  })[screen];
  announce("");
  loadScreen(screen);
}

async function loadScreen(screen) {
  try {
    if (screen === "home") await loadHome();
    if (screen === "review") await loadReview();
    if (screen === "history") await loadHistory();
    if (screen === "insights") await loadInsights();
    if (screen === "budgets") await loadBudgets();
  } catch (error) {
    announce(error.message, true);
  }
}

async function loadHome() {
  const [transactions, queue, insights] = await Promise.all([
    request("/transactions"), request("/review-queue"), request("/insights")
  ]);
  $("#home-spend").textContent = money(insights.totalSpend);
  $("#home-spend-month").textContent = insights.month ? `· ${formatMonth(insights.month)}` : "";
  $("#home-transactions").textContent = transactions.length.toLocaleString("en-IN");
  $("#home-review").textContent = queue.length.toLocaleString("en-IN");
  $("#review-count").textContent = queue.length.toLocaleString("en-IN");
  $("#home-recent").innerHTML = transactions.length
    ? transactions.slice(0, 5).map(transactionRow).join("")
    : '<p class="empty-state">No transactions yet. Upload a bank CSV to get started.</p>';
}

function transactionRow(item) {
  return `<article class="transaction-row">
    <span class="category-dot" style="background:${escapeHtml(item.categoryColor || "#007C78")}" aria-hidden="true"></span>
    <div class="transaction-main"><p class="transaction-description">${escapeHtml(item.rawDescription)}</p>
      <div class="transaction-meta"><span>${escapeHtml(item.categoryName || "Uncategorized")}</span><span aria-hidden="true">·</span><span>${escapeHtml(readableDate(item.txnDate))}</span>
      <span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></div></div>
    <strong class="transaction-amount">${escapeHtml(money(item.amount))}</strong>
  </article>`;
}

async function loadHistory() {
  const transactions = await request("/transactions");
  $("#history-total").textContent = `${transactions.length.toLocaleString("en-IN")} items`;
  $("#history-list").innerHTML = transactions.length ? transactionTable(transactions, false)
    : '<p class="empty-state">Your history is ready when you are. Upload a CSV to add transactions.</p>';
}

function transactionTable(items, review) {
  const header = `<div class="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Confidence</th>${review ? "<th scope=\"col\">Your choice</th>" : "<th scope=\"col\">Status</th>"}</tr></thead><tbody>`;
  const rows = items.map(item => `<tr>
    <td>${escapeHtml(readableDate(item.txnDate))}</td><td>${escapeHtml(item.rawDescription)}</td>
    <td>${escapeHtml(item.categoryName || "Uncategorized")}</td><td>${escapeHtml(money(item.amount))}</td>
    <td>${Math.round(Number(item.confidenceScore || 0) * 100)}%</td>
    <td>${review ? `<form class="review-controls" data-id="${Number(item.id)}"><label class="sr-only" for="category-${Number(item.id)}">Correct category for ${escapeHtml(item.rawDescription)}</label><select id="category-${Number(item.id)}" name="categoryId" required>${categoryOptions(item.categoryId)}</select><button class="button button-secondary" type="submit">Save</button></form>` : `<span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>`}</td>
  </tr>`).join("");
  return `${header}${rows}</tbody></table></div>`;
}

async function ensureCategories() {
  if (!state.categories.length) state.categories = await request("/categories");
  return state.categories;
}

function categoryOptions(selectedId) {
  return state.categories.map(category => `<option value="${Number(category.id)}" ${Number(category.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
}

async function loadReview() {
  const [items] = await Promise.all([request("/review-queue"), ensureCategories()]);
  $("#queue-total").textContent = `${items.length.toLocaleString("en-IN")} items`;
  $("#review-count").textContent = items.length.toLocaleString("en-IN");
  $("#review-list").innerHTML = items.length ? transactionTable(items, true)
    : '<p class="empty-state">You’re all caught up. New suggestions will appear here.</p>';
  $$(".review-controls").forEach(form => form.addEventListener("submit", async event => {
    event.preventDefault();
    const categoryId = Number(new FormData(form).get("categoryId"));
    try {
      await request(`/transactions/${Number(form.dataset.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId })
      });
      announce("Category saved. Thanks for helping MoneyMate learn.");
      await loadReview();
    } catch (error) { announce(error.message, true); }
  }));
}

function pieSlice(cx, cy, radius, startAngle, endAngle, color) {
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}"><title>${escapeHtml(moneyFromArc(endAngle - startAngle))}</title></path>`;
}

let pieTotal = 0;
function moneyFromArc(angle) { return money((angle / (Math.PI * 2)) * pieTotal); }

function drawPie(categories) {
  const svg = $("#pie-chart");
  const legend = $("#pie-legend");
  const data = categories.filter(item => Number(item.amount) > 0);
  pieTotal = data.reduce((sum, item) => sum + Number(item.amount), 0);
  if (!data.length) {
    svg.innerHTML = '<title id="pie-title">No category totals yet</title><text x="130" y="110" text-anchor="middle" class="chart-axis">No transaction data yet</text>';
    legend.innerHTML = "";
    return;
  }
  let angle = -Math.PI / 2;
  svg.innerHTML = data.map((item, index) => {
    const next = angle + (Number(item.amount) / pieTotal) * Math.PI * 2;
    const path = pieSlice(130, 110, 83, angle, next, PALETTE[index % PALETTE.length]);
    angle = next;
    return path;
  }).join("") + '<circle cx="130" cy="110" r="48" fill="#fffefa"></circle>' +
    `<text x="130" y="106" text-anchor="middle" class="chart-axis">TOTAL</text><text x="130" y="124" text-anchor="middle" class="chart-axis">${escapeHtml(money(pieTotal))}</text>`;
  legend.innerHTML = data.map((item, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${PALETTE[index % PALETTE.length]}" aria-hidden="true"></i>${escapeHtml(item.category)}</span>`).join("");
}

function drawBars(months) {
  const svg = $("#bar-chart");
  const data = months || [];
  if (!data.length) {
    svg.innerHTML = '<title id="bar-title">No monthly totals yet</title><text x="260" y="125" text-anchor="middle" class="chart-axis">No transaction data yet</text>';
    return;
  }
  const max = Math.max(...data.map(item => Number(item.amount)), 1);
  const left = 45, right = 505, top = 22, bottom = 205;
  const chartHeight = bottom - top, chartWidth = right - left;
  const step = chartWidth / data.length, barWidth = Math.min(35, step * .54);
  let output = "";
  [0, .5, 1].forEach(fraction => {
    const y = bottom - chartHeight * fraction;
    output += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid-line"></line><text x="${left - 7}" y="${y + 4}" text-anchor="end" class="chart-axis">${escapeHtml(money(max * fraction))}</text>`;
  });
  data.forEach((item, index) => {
    const amount = Number(item.amount);
    const height = chartHeight * amount / max;
    const x = left + step * index + (step - barWidth) / 2;
    const [year, month] = String(item.month).split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", { month: "short" });
    output += `<rect x="${x}" y="${bottom - height}" width="${barWidth}" height="${height}" rx="4" fill="${PALETTE[(index + 5) % PALETTE.length]}"><title>${escapeHtml(item.month)}: ${escapeHtml(money(amount))}</title></rect><text x="${x + barWidth / 2}" y="${bottom + 20}" text-anchor="middle" class="chart-axis">${escapeHtml(label)}</text>`;
  });
  svg.innerHTML = output;
}

async function loadInsights(month = "") {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const data = await request(`/insights${query}`);
  state.insightsMonth = data.month || "";
  const monthSelect = $("#insights-month");
  monthSelect.innerHTML = (data.availableMonths || []).length
    ? data.availableMonths.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(formatMonth(value))}</option>`).join("")
    : '<option value="">No transaction months</option>';
  monthSelect.value = data.month || "";
  monthSelect.disabled = !(data.availableMonths || []).length;
  drawPie(data.categoryTotals || []);
  drawBars(data.monthlyTrend || []);
  const categoryRows = (data.categoryTotals || []).map(item => `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(money(item.amount))}</td></tr>`).join("");
  const monthRows = (data.monthlyTrend || []).map(item => `<tr><td>${escapeHtml(item.month)}</td><td>${escapeHtml(money(item.amount))}</td></tr>`).join("");
  $("#insight-table").innerHTML = `<div class="table-wrap"><table><caption class="sr-only">Category and monthly transaction totals from your saved records</caption><thead><tr><th scope="col">Category or month</th><th scope="col">Total</th></tr></thead><tbody>${categoryRows}${monthRows || (!categoryRows ? '<tr><td colspan="2">No transaction data yet</td></tr>' : "")}</tbody></table></div>`;
}

async function loadBudgets() {
  const [budgets] = await Promise.all([request("/budgets"), ensureCategories()]);
  $("#budget-category").innerHTML = `<option value="">Choose a category</option>${categoryOptions("")}`;
  $("#budget-total").textContent = `${budgets.length.toLocaleString("en-IN")} budgets`;
  $("#budget-list").innerHTML = budgets.length ? budgets.map(budget => `<article class="budget-item">
    <span class="category-dot" style="background:${escapeHtml(budget.categoryColor || "#007C78")}" aria-hidden="true"></span>
    <div class="budget-item-info"><p class="budget-item-name">${escapeHtml(budget.categoryName)}</p><span class="budget-item-period">${escapeHtml(budget.period)} limit</span></div>
    <strong class="budget-limit">${escapeHtml(money(budget.limit))}</strong>
    <button class="icon-button delete-budget" type="button" data-category="${Number(budget.categoryId)}" aria-label="Delete ${escapeHtml(budget.categoryName)} budget">×</button>
  </article>`).join("") : '<p class="empty-state">No budgets yet. Create one to give your goals a little structure.</p>';
  $$(".delete-budget").forEach(button => button.addEventListener("click", async () => {
    try {
      await request(`/budgets/${Number(button.dataset.category)}`, { method: "DELETE" });
      announce("Budget removed.");
      await loadBudgets();
    } catch (error) { announce(error.message, true); }
  }));
}

function parseCsvHeader(line) {
  const values = [];
  let value = "", quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values.map((header, index) => header.replace(/^\uFEFF/, "") || `Column ${index + 1}`);
}

function populateMapping(headers) {
  const selectors = [
    ["#map-date", true], ["#map-description", true], ["#map-amount", false],
    ["#map-debit", false], ["#map-credit", false]
  ];
  selectors.forEach(([selector, required]) => {
    const select = $(selector);
    select.innerHTML = `${required ? "" : '<option value="">Not used</option>'}${headers.map(header => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("")}`;
  });
  const find = words => headers.find(header => words.includes(header.toLowerCase().replace(/[_-]+/g, " ")));
  $("#map-date").value = find(["date", "transaction date", "txn date", "value date"]) || headers[0] || "";
  $("#map-description").value = find(["description", "narration", "particulars", "details"]) || headers[1] || "";
  $("#map-amount").value = find(["amount", "transaction amount"]) || "";
  $("#map-debit").value = find(["debit", "withdrawal", "debit amount", "withdrawal amount"]) || "";
  $("#map-credit").value = find(["credit", "deposit", "credit amount", "deposit amount"]) || "";
  $("#mapping-panel").hidden = false;
}

async function sendUpload(mapping = null) {
  if (!state.file || state.uploadBusy) return;
  if (!state.file.name.toLowerCase().endsWith(".csv")) {
    announce("Choose a .csv file to continue.", true);
    return;
  }
  if (state.file.size > 5 * 1024 * 1024) {
    announce("This file is larger than the 5 MB limit.", true);
    return;
  }
  state.uploadBusy = true;
  $("#mapping-panel").hidden = true;
  $("#upload-result").hidden = true;
  $("#upload-progress").hidden = false;
  $("#progress-label").textContent = "Sending your statement securely…";
  const progress = $(".progress-track");
  let percent = 9;
  const timer = window.setInterval(() => {
    percent = Math.min(percent + 7, 88);
    $("#progress-fill").style.width = `${percent}%`;
    $("#progress-percent").textContent = `${percent}%`;
    progress.setAttribute("aria-valuenow", String(percent));
  }, 220);
  const form = new FormData();
  form.append("file", state.file);
  if (mapping) Object.entries(mapping).forEach(([key, value]) => {
    if (value) form.append(key, value);
  });
  try {
    const result = await request("/upload", { method: "POST", body: form });
    window.clearInterval(timer);
    $("#progress-fill").style.width = "100%";
    $("#progress-percent").textContent = "100%";
    progress.setAttribute("aria-valuenow", "100");
    $("#progress-label").textContent = "All done";
    $("#upload-result").textContent = `${Number(result.imported)} transactions added. You can review suggestions or see your full history.`;
      if (Number(result.skippedDuplicates) > 0) {
        $("#upload-result").textContent += ` ${Number(result.skippedDuplicates)} duplicate rows skipped.`;
      }
    $("#upload-result").hidden = false;
    announce(`${Number(result.imported)} transactions imported.`);
    try { await loadHome(); }
    catch (error) { announce(`Upload succeeded, but the home view could not refresh: ${error.message}`, true); }
  } catch (error) {
    window.clearInterval(timer);
    $("#upload-progress").hidden = true;
    $("#upload-result").textContent = error.message;
    $("#upload-result").hidden = false;
    announce(error.message, true);
    if (/column|detect|header/i.test(error.message) && state.file) {
      const text = await state.file.text();
      populateMapping(parseCsvHeader(text.split(/\r?\n/, 1)[0] || ""));
    }
  } finally {
    state.uploadBusy = false;
  }
}

function selectFile(file) {
  if (!file) return;
  state.file = file;
  $("#csv-file").value = "";
  $("#upload-result").hidden = true;
  $("#upload-result").textContent = "";
  $("#mapping-panel").hidden = true;
  $("#drop-zone").querySelector("h2").textContent = file.name;
  $("#drop-zone").querySelector("p").textContent = `${(file.size / 1024).toFixed(1)} KB · ready to upload`;
  sendUpload();
}

function setupUpload() {
  const input = $("#csv-file"), zone = $("#drop-zone");
  $("#choose-file").addEventListener("click", () => input.click());
  input.addEventListener("change", () => selectFile(input.files[0]));
  zone.addEventListener("click", event => { if (!event.target.closest("#choose-file")) input.click(); });
  zone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); }
  });
  ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => {
    event.preventDefault(); zone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach(type => zone.addEventListener(type, event => {
    event.preventDefault(); zone.classList.remove("is-dragging");
  }));
  zone.addEventListener("drop", event => selectFile(event.dataTransfer.files[0]));
  $("#mapping-form").addEventListener("submit", event => {
    event.preventDefault();
    sendUpload({
      dateColumn: $("#map-date").value,
      descriptionColumn: $("#map-description").value,
      amountColumn: $("#map-amount").value,
      debitColumn: $("#map-debit").value,
      creditColumn: $("#map-credit").value
    });
  });
  $("#insights-month").addEventListener("change", event => {
    loadInsights(event.target.value).catch(error => announce(error.message, true));
  });
  $("#budget-form").addEventListener("submit", async event => {
    event.preventDefault();
    const categoryId = Number($("#budget-category").value);
    const limit = Number($("#budget-limit").value);
    if (!categoryId || !Number.isFinite(limit) || limit <= 0) {
      announce("Choose a category and enter a positive limit.", true);
      return;
    }
    try {
      await request("/budgets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, limit, period: $("#budget-period").value })
      });
      $("#budget-form").reset();
      announce("Your budget is saved.");
      await loadBudgets();
    } catch (error) { announce(error.message, true); }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("#today-label").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short"
  });
  $$(".nav-link").forEach(button => button.addEventListener("click", () => setScreen(button.dataset.screen)));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => setScreen(button.dataset.go)));
  $(".brand").addEventListener("click", event => { event.preventDefault(); setScreen("home"); });
  setupUpload();
  setScreen("home");
});
