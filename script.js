// Black-Scholes-Merton option pricing and Greeks calculator

/** Standard normal probability density function */
function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Standard normal cumulative distribution function (Abramowitz & Stegun approximation) */
function normCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1 + sign * y);
}

/**
 * Computes Black-Scholes-Merton price and Greeks.
 * @param {Object} params
 * @param {"call"|"put"} params.type
 * @param {number} params.S - spot price
 * @param {number} params.K - strike price
 * @param {number} params.r - risk-free rate (decimal, e.g. 0.05)
 * @param {number} params.sigma - volatility (decimal, e.g. 0.2)
 * @param {number} params.T - time to expiry in years
 * @param {number} params.q - dividend yield (decimal)
 */
function blackScholes({ type, S, K, r, sigma, T, q }) {
  if (T <= 0) {
    throw new Error("Time to expiry must be greater than zero.");
  }
  if (sigma <= 0) {
    throw new Error("Volatility must be greater than zero.");
  }
  if (S <= 0 || K <= 0) {
    throw new Error("Spot and strike prices must be greater than zero.");
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const discountR = Math.exp(-r * T);
  const discountQ = Math.exp(-q * T);

  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const NmD1 = normCdf(-d1);
  const NmD2 = normCdf(-d2);
  const pdfD1 = normPdf(d1);

  let price, delta, theta, rho;

  if (type === "call") {
    price = S * discountQ * Nd1 - K * discountR * Nd2;
    delta = discountQ * Nd1;
    theta =
      (-S * pdfD1 * sigma * discountQ) / (2 * sqrtT) -
      r * K * discountR * Nd2 +
      q * S * discountQ * Nd1;
    rho = K * T * discountR * Nd2;
  } else {
    price = K * discountR * NmD2 - S * discountQ * NmD1;
    delta = -discountQ * NmD1;
    theta =
      (-S * pdfD1 * sigma * discountQ) / (2 * sqrtT) +
      r * K * discountR * NmD2 -
      q * S * discountQ * NmD1;
    rho = -K * T * discountR * NmD2;
  }

  const gamma = (discountQ * pdfD1) / (S * sigma * sqrtT);
  const vega = S * discountQ * pdfD1 * sqrtT;

  return {
    price,
    d1,
    d2,
    delta,
    gamma,
    vega: vega / 100, // per 1% change in vol
    theta: theta / 365, // per day
    rho: rho / 100, // per 1% change in rate
  };
}

function impliedVolatility({ type, S, K, r, q, T, premium }) {
  if (!Number.isFinite(premium) || premium <= 0 || T <= 0) return null;

  const discountR = Math.exp(-r * T);
  const discountQ = Math.exp(-q * T);
  const intrinsic = type === "call"
    ? Math.max(0, S * discountQ - K * discountR)
    : Math.max(0, K * discountR - S * discountQ);
  const upperBound = type === "call" ? S * discountQ : K * discountR;
  if (premium < intrinsic || premium >= upperBound) return null;

  let low = 1e-8;
  let high = 5;
  while (blackScholes({ type, S, K, r, sigma: high, T, q }).price < premium && high < 100) {
    high *= 2;
  }
  if (blackScholes({ type, S, K, r, sigma: high, T, q }).price < premium) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const price = blackScholes({ type, S, K, r, sigma: mid, T, q }).price;
    if (Math.abs(price - premium) < 1e-8) return mid;
    if (price < premium) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function formatNumber(n, decimals = 4) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function showError(message) {
  const box = document.getElementById("errorBox");
  box.textContent = message;
  box.hidden = false;
}

function hideError() {
  const box = document.getElementById("errorBox");
  box.hidden = true;
  box.textContent = "";
}

function readInputs() {
  const type = document.getElementById("optionType").value;
  const position = document.getElementById("position").value;
  const S = parseFloat(document.getElementById("spot").value);
  const K = parseFloat(document.getElementById("strike").value);
  const rPct = parseFloat(document.getElementById("rate").value);
  const sigmaPct = parseFloat(document.getElementById("volatility").value);
  const timeValue = parseFloat(document.getElementById("timeValue").value);
  const timeUnit = document.getElementById("timeUnit").value;
  const qPct = parseFloat(document.getElementById("dividend").value) || 0;
  const premium = parseFloat(document.getElementById("premium").value) || 0;
  const mw = parseFloat(document.getElementById("mw").value) || 0;
  const periodType = document.getElementById("periodType").value;
  const period = document.getElementById("period").value;
  const displayMode = document.getElementById("displayMode").value;

  if ([S, K, rPct, sigmaPct, timeValue].some((v) => Number.isNaN(v))) {
    throw new Error("Please fill in all required fields with valid numbers.");
  }

  const T = timeUnit === "days" ? timeValue / 365 : timeValue;

  return {
    type,
    position,
    S,
    K,
    r: rPct / 100,
    sigma: sigmaPct / 100,
    T,
    q: qPct / 100,
    premium,
    mw,
    periodType,
    period,
    displayMode,
  };
}

/** Total calendar hours (days x 24) covered by the selected period */
function computeHoursForPeriod(periodType, period) {
  let start, end;

  if (periodType === "qtr") {
    const match = period.match(/^(\d{4})Q([1-4])$/);
    if (!match) return 0;
    const year = parseInt(match[1], 10);
    const quarter = parseInt(match[2], 10);
    const startMonth = (quarter - 1) * 3;
    start = new Date(year, startMonth, 1);
    end = new Date(year, startMonth + 3, 0);
  } else {
    const match = period.match(/^(Cal|Fin)(\d{4})$/);
    if (!match) return 0;
    const kind = match[1];
    const year = parseInt(match[2], 10);
    if (kind === "Cal") {
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
    } else {
      start = new Date(year - 1, 6, 1); // Fin year runs Jul 1 (year-1) - Jun 30 (year)
      end = new Date(year, 5, 30);
    }
  }

  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return days * 24;
}

function renderResults(result, inputs) {
  const isTotal = inputs.displayMode === "total";
  const scale = isTotal ? inputs.mw * computeHoursForPeriod(inputs.periodType, inputs.period) : 1;
  const decimals = isTotal ? 2 : 4;
  const positionSign = inputs.position === "sell" ? -1 : 1;
  const iv = impliedVolatility(inputs);

  document.getElementById("outPrice").textContent = formatNumber(result.price * scale, 2);
  document.getElementById("outIv").textContent = Number.isFinite(iv) ? `${formatNumber(iv * 100, 2)}%` : "-";
  document.getElementById("outD1").textContent = formatNumber(result.d1, decimals);
  document.getElementById("outD2").textContent = formatNumber(result.d2, decimals);
  document.getElementById("outDelta").textContent = formatNumber(result.delta * positionSign * scale, decimals);
  document.getElementById("outGamma").textContent = formatNumber(result.gamma * positionSign * scale, decimals);
  document.getElementById("outVega").textContent = formatNumber(result.vega * positionSign * scale, decimals);
  document.getElementById("outTheta").textContent = formatNumber(result.theta * positionSign * scale, decimals);
  document.getElementById("outRho").textContent = formatNumber(result.rho * positionSign * scale, decimals);

  // MTM: a long position gains as price rises above premium paid, a short position gains the opposite
  const sign = inputs.position === "sell" ? -1 : 1;
  const mtm = sign * (result.price - inputs.premium) * scale;
  const mtmEl = document.getElementById("outMtm");
  mtmEl.textContent = formatNumber(mtm, 2);
  mtmEl.style.color = mtm >= 0 ? "var(--accent-2)" : "var(--danger)";

  document.getElementById("results").hidden = false;
}

/** Lognormal PDF of S_T under the risk-neutral measure implied by Black-Scholes */
function lognormalPdf(x, S, r, q, sigma, T) {
  if (x <= 0) return 0;
  const mu = Math.log(S) + (r - q - 0.5 * sigma * sigma) * T;
  const sd = sigma * Math.sqrt(T);
  const z = (Math.log(x) - mu) / sd;
  return Math.exp(-0.5 * z * z) / (x * sd * Math.sqrt(2 * Math.PI));
}

function drawDistribution(inputs) {
  const canvas = document.getElementById("distChart");
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const { S, K, r, q, sigma, T, type, position } = inputs;
  const mu = Math.log(S) + (r - q - 0.5 * sigma * sigma) * T;
  const sd = sigma * Math.sqrt(T);
  const meanPrice = Math.exp(mu + 0.5 * sd * sd);

  // x-axis range covers +/- 4 standard deviations in log-space
  const xMin = Math.max(0.01, Math.exp(mu - 4 * sd));
  const xMax = Math.exp(mu + 4 * sd);

  const points = 200;
  const xs = [];
  const ys = [];
  let yMax = 0;
  for (let i = 0; i <= points; i++) {
    const x = xMin + ((xMax - xMin) * i) / points;
    const y = lognormalPdf(x, S, r, q, sigma, T);
    xs.push(x);
    ys.push(y);
    if (y > yMax) yMax = y;
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 16 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toPx = (x) => padding.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const toPy = (y) => padding.top + plotH - (y / yMax) * plotH;

  const highlightInMoney = position !== "sell";
  const isInMoney = (x) => type === "call" ? x >= K : x <= K;
  const isHighlighted = (x) => highlightInMoney ? isInMoney(x) : !isInMoney(x);
  const startsAtLeft = type === "call" ? !highlightInMoney : highlightInMoney;
  const regionStart = startsAtLeft ? xMin : Math.max(K, xMin);
  const regionEnd = startsAtLeft ? Math.min(K, xMax) : xMax;

  ctx.beginPath();
  ctx.moveTo(toPx(regionStart), toPy(0));
  for (let i = 0; i <= points; i++) {
    const x = xs[i];
    if (isHighlighted(x)) ctx.lineTo(toPx(x), toPy(ys[i]));
  }
  ctx.lineTo(toPx(regionEnd), toPy(0));
  ctx.closePath();
  ctx.fillStyle = "rgba(79, 140, 255, 0.25)";
  ctx.fill();

  // distribution curve
  ctx.beginPath();
  xs.forEach((x, i) => {
    const px = toPx(x);
    const py = toPy(ys[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = "#e7ecf5";
  ctx.lineWidth = 2;
  ctx.stroke();

  const drawVLine = (x, color) => {
    if (x < xMin || x > xMax) return;
    const px = toPx(x);
    ctx.beginPath();
    ctx.moveTo(px, toPy(0));
    ctx.lineTo(px, padding.top);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawVLine(S, "#4f8cff");
  drawVLine(K, "#ff5d6c");
  drawVLine(meanPrice, "#33d69f");

  // baseline
  ctx.beginPath();
  ctx.moveTo(padding.left, toPy(0));
  ctx.lineTo(width - padding.right, toPy(0));
  ctx.strokeStyle = "#2a3247";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function calculate() {
  hideError();
  try {
    const inputs = readInputs();
    const result = blackScholes(inputs);
    renderResults(result, inputs);
    drawDistribution(inputs);
  } catch (err) {
    document.getElementById("results").hidden = true;
    showError(err.message);
  }
}

document.getElementById("optionForm").addEventListener("input", calculate);
document.getElementById("optionForm").addEventListener("change", calculate);

document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("optionForm").reset();
  hideError();
  setOptionType("call");
  setPosition("buy");
  setDisplayMode("unit");
  calculate();
});

// --- Option type toggle ---
function setOptionType(value) {
  document.getElementById("optionType").value = value;
  document.querySelectorAll("#optionTypeToggle .toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
  calculate();
}

document.querySelectorAll("#optionTypeToggle .toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => setOptionType(btn.dataset.value));
});

// --- Buy/Sell position toggle ---
function setPosition(value) {
  document.getElementById("position").value = value;
  document.querySelectorAll("#positionToggle .toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
  calculate();
}

document.querySelectorAll("#positionToggle .toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => setPosition(btn.dataset.value));
});

// --- Unit/Total display mode toggle ---
function setDisplayMode(value) {
  document.getElementById("displayMode").value = value;
  document.querySelectorAll("#displayModeToggle .toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
  calculate();
}

document.querySelectorAll("#displayModeToggle .toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => setDisplayMode(btn.dataset.value));
});

// --- Slider <-> number input syncing ---
function bindSlider(numberId, rangeId) {
  const numberEl = document.getElementById(numberId);
  const rangeEl = document.getElementById(rangeId);

  rangeEl.addEventListener("input", () => {
    numberEl.value = rangeEl.value;
  });

  numberEl.addEventListener("input", () => {
    const val = parseFloat(numberEl.value);
    if (Number.isNaN(val)) return;
    const min = parseFloat(rangeEl.min);
    const max = parseFloat(rangeEl.max);
    rangeEl.value = Math.min(Math.max(val, min), max);
  });
}

bindSlider("spot", "spotRange");
bindSlider("strike", "strikeRange");
bindSlider("volatility", "volatilityRange");

// --- Redisplay computed time to expiry when switching days/years ---
document.getElementById("timeUnit").addEventListener("change", computeTimeToExpiry);

// --- Period Type / Period ---
function buildStripOptions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // a Cal/Fin year is only offered while its expiry (Nov19/May19 of the prior year) is still ahead of today
  const collect = (kind, count) => {
    const years = [];
    let year = today.getFullYear();
    while (years.length < count) {
      const expiry = kind === "Fin" ? new Date(year - 1, 4, 19) : new Date(year - 1, 10, 19);
      if (expiry > today) years.push(year);
      year++;
    }
    return years;
  };

  const calYears = collect("Cal", 3);
  const finYears = collect("Fin", 3);

  const entries = [
    ...calYears.map((y) => ({ label: `Cal${y}`, expiry: new Date(y - 1, 10, 19) })),
    ...finYears.map((y) => ({ label: `Fin${y}`, expiry: new Date(y - 1, 4, 19) })),
  ];
  entries.sort((a, b) => a.expiry - b.expiry);

  return entries.map((e) => e.label);
}

function buildQtrOptions() {
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;

  const options = [];
  for (let i = 0; i < 13; i++) {
    options.push(`${year}Q${quarter}`);
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }
  return options;
}

function populatePeriodOptions() {
  const periodType = document.getElementById("periodType").value;
  const periodEl = document.getElementById("period");
  const options = periodType === "qtr" ? buildQtrOptions() : buildStripOptions();

  periodEl.innerHTML = "";
  options.forEach((opt) => {
    const el = document.createElement("option");
    el.value = opt;
    el.textContent = opt;
    periodEl.appendChild(el);
  });
  computeTimeToExpiry();
}

/** Maps a selected Period (and its Period Type) to its expiry date */
function periodToExpiryDate(periodType, period) {
  if (periodType === "qtr") {
    const match = period.match(/^(\d{4})Q([1-4])$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const quarter = parseInt(match[2], 10);
    const endMonth = quarter * 3 - 1; // 0-indexed month of quarter's last month
    return new Date(year, endMonth + 1, 0); // last day of that month
  }

  const match = period.match(/^(Cal|Fin)(\d{4})$/);
  if (!match) return null;
  const kind = match[1];
  const year = parseInt(match[2], 10);
  // expiry is the May 19 / Nov 19 immediately preceding the start of the Fin/Cal year
  return kind === "Fin" ? new Date(year - 1, 4, 19) : new Date(year - 1, 10, 19);
}

function computeTimeToExpiry() {
  const tradeDateEl = document.getElementById("tradeDate");
  const timeValueEl = document.getElementById("timeValue");
  const timeUnit = document.getElementById("timeUnit").value;
  const periodType = document.getElementById("periodType").value;
  const period = document.getElementById("period").value;

  if (!tradeDateEl.value || !period) return;

  const [y, m, d] = tradeDateEl.value.split("-").map(Number);
  const tradeDate = new Date(y, m - 1, d);
  const expiryDate = periodToExpiryDate(periodType, period);
  if (!expiryDate) return;

  const diffDays = Math.round((expiryDate - tradeDate) / (1000 * 60 * 60 * 24));
  timeValueEl.value = timeUnit === "years" ? (diffDays / 365).toFixed(4) : diffDays;
}

document.getElementById("periodType").addEventListener("change", populatePeriodOptions);
document.getElementById("period").addEventListener("change", computeTimeToExpiry);
document.getElementById("tradeDate").addEventListener("change", computeTimeToExpiry);

// default trade date to today
document.getElementById("tradeDate").value = new Date().toISOString().slice(0, 10);

populatePeriodOptions();

calculate();
