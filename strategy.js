const MAX_TRADES = 4;
const LEG_COLORS = ["#8fa9d9", "#d39bff", "#f0bd68", "#62c9c9"];
let tradeCount = 0;

function formatPayoffNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMarkerValue(value) {
  if (!Number.isFinite(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

function createTradeCard(index) {
  const card = document.createElement("section");
  card.className = "trade-card";
  card.innerHTML = `
    <div class="trade-header">
      <h3>Trade ${index}</h3>
      <button type="button" class="remove-trade" data-action="remove" aria-label="Remove trade ${index}">x</button>
    </div>
    <div class="field field-inline">
      <select data-input="position" aria-label="Trade ${index} position">
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
    </div>
    <div class="field field-inline">
      <select data-input="type" aria-label="Trade ${index} option type">
        <option value="call">Call</option>
        <option value="put">Put</option>
      </select>
    </div>
    <div class="field field-inline">
      <input type="number" data-input="spot" step="any" min="0" value="100" required aria-label="Trade ${index} spot price" />
    </div>
    <div class="field field-inline">
      <input type="number" data-input="strike" step="any" min="0" value="100" required aria-label="Trade ${index} strike price" />
    </div>
    <div class="field field-inline">
      <input type="number" data-input="premium" step="any" min="0" value="3.04" required aria-label="Trade ${index} premium" />
    </div>
    <div class="field field-inline">
      <input type="number" data-input="mw" step="any" min="0" value="1" required aria-label="Trade ${index} position size" />
    </div>`;
  return card;
}

function addTrade() {
  if (tradeCount >= MAX_TRADES) return;
  tradeCount += 1;
  document.getElementById("tradeList").appendChild(createTradeCard(tradeCount));
  updateTradeControls();
  calculateStrategy();
}

function removeTrade(card) {
  if (tradeCount <= 1) return;
  card.remove();
  tradeCount -= 1;
  document.querySelectorAll(".trade-card").forEach((trade, index) => {
    trade.querySelector("h3").textContent = `Trade ${index + 1}`;
  });
  updateTradeControls();
  calculateStrategy();
}

function updateTradeControls() {
  document.querySelectorAll(".remove-trade").forEach((button) => {
    button.hidden = tradeCount === 1;
  });
  const addButton = document.getElementById("addTradeBtn");
  addButton.disabled = tradeCount >= MAX_TRADES;
  addButton.title = tradeCount >= MAX_TRADES ? "Maximum of 4 trades reached" : "Add another trade";
  document.getElementById("tradeList").style.setProperty("--trade-count", tradeCount);
}

function readTrade(card) {
  const spot = parseFloat(card.querySelector('[data-input="spot"]').value);
  const strike = parseFloat(card.querySelector('[data-input="strike"]').value);
  const premium = parseFloat(card.querySelector('[data-input="premium"]').value);
  const mw = parseFloat(card.querySelector('[data-input="mw"]').value);

  if ([spot, strike, premium, mw].some((value) => !Number.isFinite(value)) || spot <= 0 || strike <= 0 || premium < 0 || mw < 0) {
    throw new Error("Please enter valid positive spot and strike prices, plus non-negative premium and MW values.");
  }

  return {
    type: card.querySelector('[data-input="type"]').value,
    position: card.querySelector('[data-input="position"]').value,
    spot,
    strike,
    premium,
    mw,
  };
}

function readTrades() {
  return [...document.querySelectorAll(".trade-card")].map(readTrade);
}

function payoffAtExpiry(underlying, trade) {
  const intrinsic = trade.type === "call"
    ? Math.max(underlying - trade.strike, 0)
    : Math.max(trade.strike - underlying, 0);
  const direction = trade.position === "sell" ? -1 : 1;
  return direction * (intrinsic - trade.premium) * trade.mw;
}

function buildPayoffSeries(trades) {
  const prices = trades.flatMap((trade) => [trade.spot, trade.strike]);
  const minUnderlying = Math.max(0.01, Math.min(...prices) * 0.5);
  const maxUnderlying = Math.max(...prices) * 1.5;
  const points = 160;
  const values = [];

  for (let i = 0; i <= points; i += 1) {
    const underlying = minUnderlying + ((maxUnderlying - minUnderlying) * i) / points;
    const legs = trades.map((trade) => payoffAtExpiry(underlying, trade));
    values.push({ underlying, legs, payoff: legs.reduce((total, value) => total + value, 0) });
  }

  return values;
}

function renderSummary(trades, series) {
  const breakEvens = trades.map((trade) => trade.type === "call"
    ? trade.strike + trade.premium
    : trade.strike - trade.premium);
  const maxProfit = Math.max(...series.map((point) => point.payoff));
  const maxLoss = Math.min(...series.map((point) => point.payoff));
  const rightTailChange = payoffAtUnderlying(1000000, trades) - payoffAtUnderlying(500000, trades);
  const unlimitedProfit = rightTailChange > 1000;
  const unlimitedLoss = rightTailChange < -1000;

  document.getElementById("outBreakeven").textContent = breakEvens.map(formatPayoffNumber).join(" / ");
  document.getElementById("outMaxProfit").textContent = unlimitedProfit ? "Unlimited" : formatPayoffNumber(maxProfit);
  document.getElementById("outMaxLoss").textContent = unlimitedLoss ? "Unlimited" : formatPayoffNumber(maxLoss);
  document.getElementById("outSpotPayoff").textContent = formatPayoffNumber(payoffAtReferenceSpot(trades));
}

function payoffAtReferenceSpot(trades) {
  return trades.reduce((total, trade) => total + payoffAtExpiry(trade.spot, trade), 0);
}

function payoffAtUnderlying(underlying, trades) {
  return trades.reduce((total, trade) => total + payoffAtExpiry(underlying, trade), 0);
}

function drawPayoffChart(trades, series) {
  const canvas = document.getElementById("payoffChart");
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const padding = { top: 22, right: 22, bottom: 38, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxAbsPayoff = Math.max(1, ...series.flatMap((point) => [Math.abs(point.payoff), ...point.legs.map(Math.abs)]));
  const yLimit = maxAbsPayoff * 1.12;
  const xMin = series[0].underlying;
  const xMax = series[series.length - 1].underlying;
  const toX = (value) => padding.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const toY = (value) => padding.top + plotHeight / 2 - (value / yLimit) * (plotHeight / 2);

  context.clearRect(0, 0, width, height);
  context.font = "12px Segoe UI, sans-serif";
  context.fillStyle = "#9aa5b8";
  context.strokeStyle = "#2a3247";
  context.lineWidth = 1;

  context.beginPath();
  context.moveTo(padding.left, toY(0));
  context.lineTo(width - padding.right, toY(0));
  context.stroke();
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, height - padding.bottom);
  context.stroke();

  context.fillText(formatPayoffNumber(yLimit), 6, toY(yLimit) + 4);
  context.fillText(formatPayoffNumber(-yLimit), 6, toY(-yLimit) + 4);
  context.fillText("0", 38, toY(0) + 4);
  context.fillText("Underlying price at expiry", width / 2 - 70, height - 8);
  context.fillText(formatPayoffNumber(xMin), padding.left - 10, height - 18);
  context.fillText(formatPayoffNumber(xMax), width - padding.right - 20, height - 18);

  series.forEach((point, index) => {
    if (index === series.length - 1) return;
    const next = series[index + 1];
    context.beginPath();
    context.moveTo(toX(point.underlying), toY(0));
    context.lineTo(toX(point.underlying), toY(point.payoff));
    context.lineTo(toX(next.underlying), toY(next.payoff));
    context.lineTo(toX(next.underlying), toY(0));
    context.closePath();
    context.fillStyle = (point.payoff + next.payoff) / 2 >= 0
      ? "rgba(51, 214, 159, 0.12)"
      : "rgba(255, 93, 108, 0.12)";
    context.fill();
  });

  trades.forEach((trade, tradeIndex) => {
    context.beginPath();
    series.forEach((point, index) => {
      const x = toX(point.underlying);
      const y = toY(point.legs[tradeIndex]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = LEG_COLORS[tradeIndex];
    context.lineWidth = 1.5;
    context.stroke();

    const labelPoint = series[Math.floor(series.length * 0.82)];
    context.fillStyle = LEG_COLORS[tradeIndex];
    context.font = "600 12px Segoe UI, sans-serif";
    context.fillText(`Trade ${tradeIndex + 1}`, toX(labelPoint.underlying) + 6, toY(labelPoint.legs[tradeIndex]) - 6);
  });

  context.beginPath();
  series.forEach((point, index) => {
    const x = toX(point.underlying);
    const y = toY(point.payoff);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = "#33d69f";
  context.lineWidth = 4;
  context.stroke();

  const drawMarker = (value, color, label, labelOffset) => {
    if (value < xMin || value > xMax) return;
    context.beginPath();
    context.moveTo(toX(value), padding.top);
    context.lineTo(toX(value), height - padding.bottom);
    context.strokeStyle = color;
    context.setLineDash([5, 4]);
    context.lineWidth = 1;
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = color;
    context.font = "600 11px Segoe UI, sans-serif";
    context.fillText(label, toX(value) + 4, padding.top + labelOffset);
  };

  if (trades.length > 0) {
    drawMarker(trades[0].spot, "#4f8cff", `Spot: ${formatMarkerValue(trades[0].spot)}`, 14);
  }

  trades.forEach((trade, tradeIndex) => {
    const markerOffset = 14 + (tradeIndex % 4) * 14;
    drawMarker(trade.strike, "#ff5d6c", `Trade ${tradeIndex + 1} K: ${formatMarkerValue(trade.strike)}`, markerOffset + 14);
  });
}

function calculateStrategy() {
  const errorBox = document.getElementById("strategyError");
  try {
    const trades = readTrades();
    const series = buildPayoffSeries(trades);
    errorBox.hidden = true;
    renderSummary(trades, series);
    drawPayoffChart(trades, series);
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

document.getElementById("strategyForm").addEventListener("input", calculateStrategy);
document.getElementById("strategyForm").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "remove") removeTrade(button.closest(".trade-card"));
});

document.getElementById("addTradeBtn").addEventListener("click", addTrade);
addTrade();
