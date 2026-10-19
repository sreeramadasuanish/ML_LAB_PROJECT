
"use strict";

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const API_BASE_URL = "http://localhost:8081/api";

const PALETTE = [
  "#E69F00", "#56B4E9", "#CC79A7", "#0072B2",
  "#F0E442", "#009E73", "#D55E00", "#666666"
];

const state = {
  screen: "home",
  categories: [],
  file: null,
  uploadBusy: false,
  insightsMonth: "",
  isSimpleMode: false,
  isHighContrast: false,
  fontSize: 100,
  isReading: false
};

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

/* ==========================================================================
   FORMATTING AND UTILITIES
   ========================================================================== */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function readableDate(value) {
  if (!value) return "—";

  const parts = String(value).split("-");

  if (parts.length === 3) {
    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  return String(value);
}

function formatMonth(value) {
  if (!value) return "No transaction month";

  const [year, month] = value.split("-").map(Number);

  return new Date(year, month - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

function announce(message, isError = false) {
  const notice = $("#notice");

  if (!notice) return;

  notice.textContent = message;
  notice.classList.toggle("is-error", isError);
  notice.hidden = !message;

  if (message) {
    window.setTimeout(() => {
      if (notice.textContent === message) {
        notice.hidden = true;
      }
    }, 6000);
  }
}

function showEmptyMessage(container, message) {
  if (!container) return;

  const paragraph = document.createElement("p");
  paragraph.className = "empty-state";
  paragraph.textContent = message;

  container.replaceChildren(paragraph);
}

/* ==========================================================================
   ACCESSIBILITY
   ========================================================================== */

function toggleSimpleMode() {
  state.isSimpleMode = !state.isSimpleMode;

  document.body.classList.toggle(
      "mode-simple",
      state.isSimpleMode
  );

  const button = $("#btn-simple-mode");

  if (button) {
    button.setAttribute("aria-pressed", String(state.isSimpleMode));
    button.textContent = state.isSimpleMode
        ? "✨ Simple Mode: ON"
        : "✨ Simple Mode: OFF";
  }
}

function toggleHighContrast() {
  state.isHighContrast = !state.isHighContrast;

  document.body.classList.toggle(
      "theme-high-contrast",
      state.isHighContrast
  );

  const button = $("#btn-contrast");

  if (button) {
    button.setAttribute("aria-pressed", String(state.isHighContrast));
  }
}

function adjustFontSize(delta) {
  state.fontSize = Math.min(
      200,
      Math.max(100, state.fontSize + delta)
  );

  document.body.classList.toggle(
      "font-scaled",
      state.fontSize > 100
  );

  document.body.style.fontSize = `${state.fontSize}%`;

  const label = $("#font-size-label");

  if (label) {
    label.textContent = `${state.fontSize}%`;
  }
}

function toggleReadAloud() {
  if (!("speechSynthesis" in window)) {
    announce("Text-to-speech is not supported in this browser.", true);
    return;
  }

  state.isReading = !state.isReading;

  const button = $("#btn-read-aloud");

  if (!state.isReading) {
    window.speechSynthesis.cancel();
    document.removeEventListener("click", readElementOnClick);

    if (button) button.textContent = "🔊 Read Aloud";

    announce("Read aloud turned off.");
  } else {
    if (button) button.textContent = "⏹️ Tap item to read";

    announce(
        "Tap or click any text, transaction, or card to read it aloud."
    );

    document.addEventListener("click", readElementOnClick);
  }
}

function readElementOnClick(event) {
  if (!state.isReading) return;
  if (event.target.closest(".a11y-toolbar")) return;

  const text = event.target.innerText || event.target.textContent;

  if (text && text.trim()) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    window.speechSynthesis.speak(utterance);
  }
}

/* ==========================================================================
   LANGUAGE SUPPORT
   ========================================================================== */

const i18n = {
  en: {
    "nav-home": "Home",
    "nav-upload": "Upload",
    "nav-review": "Review queue",
    "nav-history": "Transaction history",
    "nav-insights": "Insights",
    "nav-budgets": "Budgets",
    "home-eyebrow": "YOUR FINANCIAL SNAPSHOT",
    "recent-title": "Recent transactions",
    "nudge-title": "Small steps count.",
    "nudge-copy":
        "A quick review helps MoneyMate learn what matters to you."
  },
  hi: {
    "nav-home": "होम",
    "nav-upload": "अपलोड",
    "nav-review": "समीक्षा कतार",
    "nav-history": "लेन-देन इतिहास",
    "nav-insights": "अंतर्दृष्टि",
    "nav-budgets": "बजट",
    "home-eyebrow": "आपका वित्तीय सारांश",
    "recent-title": "हाल के लेन-देन",
    "nudge-title": "छोटे कदम मायने रखते हैं।",
    "nudge-copy":
        "एक त्वरित समीक्षा मनीमेट को यह सीखने में मदद करती है कि आपके लिए क्या महत्वपूर्ण है।"
  },
  mr: {
    "nav-home": "मुख्य पृष्ठ",
    "nav-upload": "अपलोड करा",
    "nav-review": "पुनरावलोकन रांग",
    "nav-history": "व्यवहार इतिहास",
    "nav-insights": "विश्लेषण",
    "nav-budgets": "बजेट",
    "home-eyebrow": "तुमचा आर्थिक सारांश",
    "recent-title": "नुकतेच झालेले व्यवहार",
    "nudge-title": "लहान पावले महत्त्वाची आहेत.",
    "nudge-copy":
        "एक जलद पुनरावलोकन मनीमेटला तुमच्यासाठी काय महत्त्वाचे आहे ते शिकण्यास मदत करते."
  },
  kn: {
    "nav-home": "ಮುಖ್ಯ ಪುಟ",
    "nav-upload": "ಅಪ್‌ಲೋಡ್",
    "nav-review": "ಪರಿಶೀಲನೆ ಸಾಲು",
    "nav-history": "ವಹಿವಾಟು ಇತಿಹಾಸ",
    "nav-insights": "ಒಳನೋಟಗಳು",
    "nav-budgets": "ಬಜೆಟ್‌ಗಳು",
    "home-eyebrow": "ನಿಮ್ಮ ಹಣಕಾಸಿನ ಸ್ನ್ಯಾಪ್‌ಶಾಟ್",
    "recent-title": "ಇತ್ತೀಚಿನ ವಹಿವಾಟುಗಳು",
    "nudge-title": "ಸಣ್ಣ ಹೆಜ್ಜೆಗಳು ಮುಖ್ಯವಾಗುತ್ತವೆ.",
    "nudge-copy":
        "ತ್ವರಿತ ಪರಿಶೀಲನೆಯು ನಿಮಗೆ ಯಾವುದು ಮುಖ್ಯ ಎಂಬುದನ್ನು ತಿಳಿಯಲು ಮನಿಮೇಟ್‌ಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ."
  }
};

function changeLanguage(langCode) {
  const dictionary = i18n[langCode] || i18n.en;

  $$(".nav-link").forEach(button => {
    const screen = button.dataset.screen;
    const translated = dictionary[`nav-${screen}`];

    if (!translated) return;

    const icon = button.querySelector("span");

    button.replaceChildren();

    if (icon) {
      button.appendChild(icon);
      button.appendChild(document.createTextNode(" "));
    }

    button.appendChild(document.createTextNode(translated));

    if (screen === "review") {
      const count = document.createElement("span");
      count.className = "nav-count";
      count.id = "review-count";
      count.textContent = "—";
      button.appendChild(document.createTextNode(" "));
      button.appendChild(count);
    }
  });

  const eyebrow = $("#home-screen .eyebrow");

  if (eyebrow && dictionary["home-eyebrow"]) {
    eyebrow.textContent = dictionary["home-eyebrow"];
  }

  const recentTitle = $("#recent-title");

  if (recentTitle && dictionary["recent-title"]) {
    recentTitle.textContent = dictionary["recent-title"];
  }

  const nudgeTitle = $("#home-screen .side-panel h2");

  if (nudgeTitle && dictionary["nudge-title"]) {
    nudgeTitle.textContent = dictionary["nudge-title"];
  }

  const nudgeCopy = $("#home-screen .nudge-copy");

  if (nudgeCopy && dictionary["nudge-copy"]) {
    nudgeCopy.textContent = dictionary["nudge-copy"];
  }

  announce(`Language updated to ${langCode.toUpperCase()}.`);
}

/* ==========================================================================
   REST API
   ========================================================================== */

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
            ? {}
            : { Accept: "application/json" }),
        ...options.headers
      }
    });
  } catch {
    throw new Error(
        "Cannot connect to MoneyMate backend. Check that Spring Boot is running on port 8081."
    );
  }

  const raw = await response.text();
  let body = null;

  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = { message: raw };
    }
  }

  if (!response.ok) {
    throw new Error(
        body?.message ||
        body?.error ||
        `Request failed with HTTP ${response.status}`
    );
  }

  return body;
}

/* ==========================================================================
   NAVIGATION
   ========================================================================== */

function setScreen(screen) {
  const validScreens = [
    "home", "upload", "review",
    "history", "insights", "budgets"
  ];

  if (!validScreens.includes(screen)) return;

  state.screen = screen;

  $$(".screen").forEach(section => {
    const visible = section.id === `${screen}-screen`;

    section.hidden = !visible;
    section.classList.toggle("is-visible", visible);
  });

  $$(".nav-link").forEach(button => {
    const active = button.dataset.screen === screen;

    button.classList.toggle("is-active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const currentSection = $("#current-section");

  if (currentSection) {
    currentSection.textContent = ({
      home: "Home",
      upload: "Upload",
      review: "Review queue",
      history: "Transaction history",
      insights: "Insights",
      budgets: "Budgets"
    })[screen];
  }

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

/* ==========================================================================
   HOME AND TRANSACTIONS
   ========================================================================== */

async function quickAddTransaction(categoryName, amount) {
  try {
    const categories = await ensureCategories();

    const target = categories.find(category =>
        String(category.name).toLowerCase().includes(
            categoryName.toLowerCase()
        )
    );

    if (!target) {
      throw new Error(
          `No matching category found for "${categoryName}". Create or select a matching category first.`
      );
    }

    await request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawDescription: `Quick Entry: ${categoryName}`,
        amount,
        categoryId: Number(target.id),
        txnDate: new Date().toISOString().split("T")[0]
      })
    });

    announce(`Added ${money(amount)} for ${categoryName}.`);

    if (state.screen === "home") await loadHome();
  } catch (error) {
    announce(`Quick entry failed: ${error.message}`, true);
  }
}

function getHumanAiReason(item) {
  const description = String(item.rawDescription || "").toLowerCase();

  if (description.includes("swiggy") || description.includes("zomato")) {
    return "Recognized a food-delivery merchant in the transaction description.";
  }

  if (description.includes("upi") || description.includes("transfer")) {
    return "Matched a UPI transfer narration pattern.";
  }

  if (description.includes("amazon") || description.includes("flipkart")) {
    return "Matched an online shopping vendor keyword.";
  }

  if (
      item.confidenceScore &&
      Number(item.confidenceScore) > 0.8
  ) {
    return `High-confidence prediction (${Math.round(
        Number(item.confidenceScore) * 100
    )}%) based on the categorization model.`;
  }

  return "Categorized using available transaction patterns. You can correct it in the review queue.";
}

async function loadHome() {
  const [transactions, queue, insights] = await Promise.all([
    request("/transactions"),
    request("/review-queue"),
    request("/insights")
  ]);

  $("#home-spend").textContent = money(insights.totalSpend);

  $("#home-spend-month").textContent = insights.month
      ? `· ${formatMonth(insights.month)}`
      : "";

  $("#home-transactions").textContent =
      transactions.length.toLocaleString("en-IN");

  $("#home-review").textContent =
      queue.length.toLocaleString("en-IN");

  $("#review-count").textContent =
      queue.length.toLocaleString("en-IN");

  $("#home-recent").innerHTML = transactions.length
      ? transactions.slice(0, 5).map(transactionRow).join("")
      : '<p class="empty-state">No transactions yet. Upload a bank CSV to get started.</p>';
}

function transactionRow(item) {
  const reason = getHumanAiReason(item);

  return `<article class="transaction-row" style="flex-direction:column;align-items:stretch;gap:4px">
    <div style="display:flex;align-items:center;gap:12px;width:100%">
      <span class="category-dot" style="background:${escapeHtml(item.categoryColor || "#007C78")}" aria-hidden="true"></span>
      <div class="transaction-main">
        <p class="transaction-description">${escapeHtml(item.rawDescription)}</p>
        <div class="transaction-meta">
          <span>${escapeHtml(item.categoryName || "Uncategorized")}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeHtml(readableDate(item.txnDate))}</span>
          <span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status || "Unknown")}</span>
        </div>
      </div>
      <strong class="transaction-amount">${escapeHtml(money(item.amount))}</strong>
    </div>
    <div class="explainable-reason">
      <span>💡 <strong>AI Reason:</strong> ${escapeHtml(reason)}</span>
    </div>
  </article>`;
}

async function loadHistory() {
  const transactions = await request("/transactions");

  $("#history-total").textContent =
      `${transactions.length.toLocaleString("en-IN")} items`;

  $("#history-list").innerHTML = transactions.length
      ? transactionTable(transactions, false)
      : '<p class="empty-state">Your history is ready when you are. Upload a CSV to add transactions.</p>';
}

function transactionTable(items, review) {
  const header = `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Description</th>
          <th scope="col">Category</th>
          <th scope="col">Amount</th>
          <th scope="col">Confidence</th>
          <th scope="col">${review ? "Your choice" : "Status"}</th>
        </tr>
      </thead>
      <tbody>`;

  const rows = items.map(item => {
    const confidence = Math.round(
        Number(item.confidenceScore || 0) * 100
    );

    return `<tr>
      <td>${escapeHtml(readableDate(item.txnDate))}</td>
      <td>${escapeHtml(item.rawDescription)}</td>
      <td>${escapeHtml(item.categoryName || "Uncategorized")}</td>
      <td>${escapeHtml(money(item.amount))}</td>
      <td>${confidence}%</td>
      <td>${review
        ? `<form class="review-controls" data-id="${Number(item.id)}">
             <label class="sr-only" for="category-${Number(item.id)}">Correct category for ${escapeHtml(item.rawDescription)}</label>
             <select id="category-${Number(item.id)}" name="categoryId" required>
               ${categoryOptions(item.categoryId)}
             </select>
             <button class="button button-secondary" type="submit">Save</button>
           </form>`
        : `<span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(item.status || "Unknown")}</span>`
    }</td>
    </tr>`;
  }).join("");

  return `${header}${rows}</tbody></table></div>`;
}

/* ==========================================================================
   CATEGORIES AND REVIEW QUEUE
   ========================================================================== */

async function ensureCategories() {
  if (!state.categories.length) {
    state.categories = await request("/categories");
  }

  return state.categories;
}

function categoryOptions(selectedId) {
  return state.categories.map(category =>
      `<option value="${Number(category.id)}" ${
          Number(category.id) === Number(selectedId) ? "selected" : ""
      }>${escapeHtml(category.name)}</option>`
  ).join("");
}

async function loadReview() {
  const [, items] = await Promise.all([
    ensureCategories(),
    request("/review-queue")
  ]);

  $("#queue-total").textContent =
      `${items.length.toLocaleString("en-IN")} items`;

  $("#review-count").textContent =
      items.length.toLocaleString("en-IN");

  $("#review-list").innerHTML = items.length
      ? transactionTable(items, true)
      : '<p class="empty-state">You’re all caught up. New suggestions will appear here.</p>';

  $$(".review-controls").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const categoryId = Number(
          new FormData(form).get("categoryId")
      );

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) submitButton.disabled = true;

      try {
        await request(`/transactions/${Number(form.dataset.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId })
        });

        announce("Category saved. Thanks for helping MoneyMate learn.");

        await Promise.all([loadReview(), loadHome()]);
      } catch (error) {
        announce(error.message, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
}

/* ==========================================================================
   INSIGHTS CHARTS
   ========================================================================== */

function drawPie(categories) {
  const svg = $("#pie-chart");
  const legend = $("#pie-legend");

  const data = categories.filter(item => Number(item.amount) > 0);
  const total = data.reduce(
      (sum, item) => sum + Number(item.amount),
      0
  );

  if (!data.length || total <= 0) {
    svg.innerHTML = '<title id="pie-title">No category totals yet</title><text x="130" y="110" text-anchor="middle" class="chart-axis">No transaction data yet</text>';
    legend.replaceChildren();
    return;
  }

  let angle = -Math.PI / 2;

  const paths = data.map((item, index) => {
    const next = angle + (Number(item.amount) / total) * Math.PI * 2;

    const x1 = 130 + 83 * Math.cos(angle);
    const y1 = 110 + 83 * Math.sin(angle);
    const x2 = 130 + 83 * Math.cos(next);
    const y2 = 110 + 83 * Math.sin(next);
    const largeArc = next - angle > Math.PI ? 1 : 0;
    const color = PALETTE[index % PALETTE.length];

    const path = `<path d="M 130 110 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 83 83 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}">
      <title>${escapeHtml(item.category)}: ${escapeHtml(money(item.amount))}</title>
    </path>`;

    angle = next;
    return path;
  }).join("");

  svg.innerHTML = `${paths}
    <circle cx="130" cy="110" r="48" fill="#fffefa"></circle>
    <text x="130" y="106" text-anchor="middle" class="chart-axis">TOTAL</text>
    <text x="130" y="124" text-anchor="middle" class="chart-axis">${escapeHtml(money(total))}</text>`;

  legend.innerHTML = data.map((item, index) =>
      `<span class="legend-item">
      <i class="legend-swatch" style="background:${PALETTE[index % PALETTE.length]}" aria-hidden="true"></i>
      ${escapeHtml(item.category)}: ${escapeHtml(money(item.amount))}
    </span>`
  ).join("");
}

function drawBars(months) {
  const svg = $("#bar-chart");
  const data = months || [];

  if (!data.length) {
    svg.innerHTML = '<title id="bar-title">No monthly totals yet</title><text x="260" y="125" text-anchor="middle" class="chart-axis">No transaction data yet</text>';
    return;
  }

  const max = Math.max(...data.map(item => Number(item.amount)), 1);
  const left = 45;
  const right = 505;
  const top = 22;
  const bottom = 205;
  const chartHeight = bottom - top;
  const step = (right - left) / data.length;
  const barWidth = Math.min(35, step * 0.54);

  let output = "";

  [0, 0.5, 1].forEach(fraction => {
    const y = bottom - chartHeight * fraction;

    output += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid-line"></line>
      <text x="${left - 7}" y="${y + 4}" text-anchor="end" class="chart-axis">${escapeHtml(money(max * fraction))}</text>`;
  });

  data.forEach((item, index) => {
    const amount = Number(item.amount);
    const height = chartHeight * amount / max;
    const x = left + step * index + (step - barWidth) / 2;
    const [year, month] = String(item.month).split("-");

    const label = new Date(
        Number(year),
        Number(month) - 1
    ).toLocaleDateString("en-IN", { month: "short" });

    output += `<rect x="${x}" y="${bottom - height}" width="${barWidth}" height="${height}" rx="4" fill="${PALETTE[(index + 5) % PALETTE.length]}">
      <title>${escapeHtml(item.month)}: ${escapeHtml(money(amount))}</title>
    </rect>
    <text x="${x + barWidth / 2}" y="${bottom + 20}" text-anchor="middle" class="chart-axis">${escapeHtml(label)}</text>`;
  });

  svg.innerHTML = output;
}

async function loadInsights(month = "") {
  const query = month
      ? `?month=${encodeURIComponent(month)}`
      : "";

  const data = await request(`/insights${query}`);

  state.insightsMonth = data.month || "";

  const monthSelect = $("#insights-month");
  const months = data.availableMonths || [];

  monthSelect.innerHTML = months.length
      ? months.map(value =>
          `<option value="${escapeHtml(value)}">${escapeHtml(formatMonth(value))}</option>`
      ).join("")
      : '<option value="">No transaction months</option>';

  monthSelect.value = data.month || "";
  monthSelect.disabled = months.length === 0;

  drawPie(data.categoryTotals || []);
  drawBars(data.monthlyTrend || []);

  const categoryRows = (data.categoryTotals || []).map(item =>
      `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(money(item.amount))}</td></tr>`
  ).join("");

  const monthRows = (data.monthlyTrend || []).map(item =>
      `<tr><td>${escapeHtml(formatMonth(item.month))}</td><td>${escapeHtml(money(item.amount))}</td></tr>`
  ).join("");

  $("#insight-table").innerHTML = `<div class="table-wrap">
    <table>
      <caption class="sr-only">Category and monthly transaction totals</caption>
      <thead><tr><th scope="col">Category or month</th><th scope="col">Total</th></tr></thead>
      <tbody>
        ${categoryRows}
        ${monthRows}
        ${!categoryRows && !monthRows
      ? '<tr><td colspan="2">No transaction data yet</td></tr>'
      : ""}
      </tbody>
    </table>
  </div>`;
}

/* ==========================================================================
   BUDGETS
   ========================================================================== */

async function loadBudgets() {
  const [budgets] = await Promise.all([
    request("/budgets"),
    ensureCategories()
  ]);

  $("#budget-category").innerHTML =
      '<option value="">Choose a category</option>' + categoryOptions("");

  $("#budget-total").textContent =
      `${budgets.length.toLocaleString("en-IN")} budgets`;

  $("#budget-list").innerHTML = budgets.length
      ? budgets.map(budget => `<article class="budget-item">
        <span class="category-dot" style="background:${escapeHtml(budget.categoryColor || "#007C78")}" aria-hidden="true"></span>
        <div class="budget-item-info">
          <p class="budget-item-name">${escapeHtml(budget.categoryName)}</p>
          <span class="budget-item-period">${escapeHtml(budget.period)} limit</span>
        </div>
        <strong class="budget-limit">${escapeHtml(money(budget.limit))}</strong>
        <button class="icon-button delete-budget" type="button" data-category="${Number(budget.categoryId)}" aria-label="Delete ${escapeHtml(budget.categoryName)} budget">×</button>
      </article>`).join("")
      : '<p class="empty-state">No budgets yet. Create one to give your goals a little structure.</p>';

  $$(".delete-budget").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        await request(`/budgets/${Number(button.dataset.category)}`, {
          method: "DELETE"
        });

        announce("Budget removed.");
        await loadBudgets();
      } catch (error) {
        announce(error.message, true);
      }
    });
  });
}

/* ==========================================================================
   CSV UPLOAD
   ========================================================================== */

function parseCsvHeader(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());

  return values.map((header, index) =>
      header.replace(/^\uFEFF/, "") || `Column ${index + 1}`
  );
}

function populateMapping(headers) {
  const selectors = [
    ["#map-date", true],
    ["#map-description", true],
    ["#map-amount", false],
    ["#map-debit", false],
    ["#map-credit", false]
  ];

  selectors.forEach(([selector, required]) => {
    const select = $(selector);

    select.innerHTML =
        `${required ? "" : '<option value="">Not used</option>'}` +
        headers.map(header =>
            `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`
        ).join("");
  });

  const find = names => headers.find(header =>
      names.includes(header.toLowerCase().replace(/[_-]+/g, " ").trim())
  );

  $("#map-date").value =
      find(["date", "transaction date", "txn date", "value date"]) ||
      headers[0] || "";

  $("#map-description").value =
      find(["description", "narration", "particulars", "details"]) ||
      headers[1] || "";

  $("#map-amount").value =
      find(["amount", "transaction amount"]) || "";

  $("#map-debit").value =
      find(["debit", "withdrawal", "debit amount", "withdrawal amount"]) || "";

  $("#map-credit").value =
      find(["credit", "deposit", "credit amount", "deposit amount"]) || "";

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
  $("#progress-label").textContent = "Sending your statement…";

  const progress = $(".progress-track");
  let percent = 9;

  $("#progress-fill").style.width = `${percent}%`;
  $("#progress-percent").textContent = `${percent}%`;
  progress.setAttribute("aria-valuenow", String(percent));

  const timer = window.setInterval(() => {
    percent = Math.min(percent + 7, 88);
    $("#progress-fill").style.width = `${percent}%`;
    $("#progress-percent").textContent = `${percent}%`;
    progress.setAttribute("aria-valuenow", String(percent));
  }, 220);

  const form = new FormData();
  form.append("file", state.file);

  if (mapping) {
    Object.entries(mapping).forEach(([key, value]) => {
      if (value) form.append(key, value);
    });
  }

  try {
    const result = await request("/upload", {
      method: "POST",
      body: form
    });

    $("#progress-fill").style.width = "100%";
    $("#progress-percent").textContent = "100%";
    progress.setAttribute("aria-valuenow", "100");
    $("#progress-label").textContent = "All done";

    const imported = Number(result?.imported ?? 0);
    const skipped = Number(result?.skippedDuplicates ?? 0);

    $("#upload-result").textContent =
        `${imported} transactions added.` +
        (skipped > 0 ? ` ${skipped} duplicate rows skipped.` : "");

    $("#upload-result").hidden = false;
    announce(`${imported} transactions imported.`);

    await loadHome();
  } catch (error) {
    $("#upload-progress").hidden = true;
    $("#upload-result").textContent = error.message;
    $("#upload-result").hidden = false;

    announce(error.message, true);

    if (/column|detect|header/i.test(error.message) && state.file) {
      const text = await state.file.text();
      populateMapping(parseCsvHeader(text.split(/\r?\n/, 1)[0] || ""));
    }
  } finally {
    window.clearInterval(timer);
    state.uploadBusy = false;
  }
}

function selectFile(file) {
  if (!file) return;

  state.file = file;

  $("#upload-result").hidden = true;
  $("#upload-result").textContent = "";
  $("#mapping-panel").hidden = true;

  $("#drop-zone").querySelector("h2").textContent = file.name;
  $("#drop-zone").querySelector("p").textContent =
      `${(file.size / 1024).toFixed(1)} KB · ready to upload`;

  sendUpload();
}

function setupUpload() {
  const input = $("#csv-file");
  const zone = $("#drop-zone");

  $("#choose-file").addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    selectFile(input.files[0]);
  });

  zone.addEventListener("click", event => {
    if (!event.target.closest("#choose-file")) input.click();
  });

  zone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove("is-dragging");
    });
  });

  zone.addEventListener("drop", event => {
    selectFile(event.dataTransfer.files[0]);
  });

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
    loadInsights(event.target.value).catch(error => {
      announce(error.message, true);
    });
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          limit,
          period: $("#budget-period").value
        })
      });

      $("#budget-form").reset();
      announce("Your budget is saved.");
      await loadBudgets();
    } catch (error) {
      announce(error.message, true);
    }
  });
}

/* ==========================================================================
   FINANCIAL ADVISOR
   ========================================================================== */

function addAdvisorText(container, tagName, text, className = "") {
  const element = document.createElement(tagName);

  if (className) element.className = className;
  element.textContent = text;

  container.appendChild(element);
  return element;
}

function getAdvisorValue(data, camelCase, snakeCase) {
  return data?.[camelCase] ?? data?.[snakeCase];
}

function renderFinancialAdvice(data) {
  const container = $("#advisor-tips-container");

  if (!container) return;

  container.replaceChildren();

  const remainingBudget = getAdvisorValue(
      data,
      "remainingBudget",
      "remaining_budget"
  );

  const projectedSavings = getAdvisorValue(
      data,
      "projectedSavings",
      "projected_savings"
  );

  const summary = document.createElement("div");
  summary.className = "advisor-card";

  addAdvisorText(summary, "h3", "Your financial summary");

  if (remainingBudget !== undefined && remainingBudget !== null) {
    addAdvisorText(
        summary,
        "p",
        `Remaining budget: ${money(remainingBudget)}`
    );
  }

  if (projectedSavings !== undefined && projectedSavings !== null) {
    addAdvisorText(
        summary,
        "p",
        `Projected savings: ${money(projectedSavings)}`
    );
  }

  if (summary.childElementCount > 1) {
    container.appendChild(summary);
  }

  addAdvisorText(container, "h3", "Suggestions for you");

  const advice = data?.adviceList ?? data?.advice_list ?? data?.suggestions;
  const adviceList = Array.isArray(advice)
      ? advice
      : typeof advice === "string"
          ? [advice]
          : [];

  if (adviceList.length === 0) {
    addAdvisorText(
        container,
        "p",
        "No suggestions are available right now."
    );
    return;
  }

  const results = document.createElement("div");
  results.className = "advisor-results";

  adviceList.forEach(tip => {
    const card = document.createElement("article");
    card.className = "advisor-card";

    const text = typeof tip === "string"
        ? tip
        : tip?.message ?? tip?.advice ?? JSON.stringify(tip);

    addAdvisorText(card, "p", text);
    results.appendChild(card);
  });

  container.appendChild(results);
}

function setupFinancialAdvisor() {
  const form = $("#advisor-form");
  const incomeInput = $("#advisor-income");
  const submitButton = $("#advisor-submit");
  const container = $("#advisor-tips-container");

  if (!form || !incomeInput || !submitButton || !container) {
    console.warn(
        "Financial Advisor elements are missing from index.html."
    );
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const monthlyIncome = Number(incomeInput.value);

    if (
        incomeInput.value.trim() === "" ||
        !Number.isFinite(monthlyIncome) ||
        monthlyIncome < 0
    ) {
      announce("Enter a valid monthly income.", true);
      incomeInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Generating suggestions…";

    container.replaceChildren();
    addAdvisorText(
        container,
        "p",
        "Reviewing your financial information…",
        "loading-state"
    );

    try {
      const params = new URLSearchParams({
        userId: "1",
        monthlyIncome: String(monthlyIncome)
      });

      const data = await request(
          `/advisor/suggestions?${params.toString()}`
      );

      renderFinancialAdvice(data);
      announce("Your financial suggestions are ready.");
    } catch (error) {
      container.replaceChildren();

      addAdvisorText(
          container,
          "p",
          `Could not load financial advice: ${error.message}`,
          "advisor-status"
      );

      announce("Financial Advisor request failed.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Get my suggestions →";
    }
  });
}

/* ==========================================================================
   APP INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const todayLabel = $("#today-label");

  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  }

  $$(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      setScreen(button.dataset.screen);
    });
  });

  $$("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      setScreen(button.dataset.go);
    });
  });

  const brand = $(".brand");

  if (brand) {
    brand.addEventListener("click", event => {
      event.preventDefault();
      setScreen("home");
    });
  }

  setupUpload();
  setupFinancialAdvisor();

  // Load the dashboard only.
  // Financial advice is requested after the user submits monthly income.
  setScreen("home");
});
