# Implied Volatility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display implied volatility implied by the entered unit premium in the existing Black-Scholes calculator.

**Architecture:** Keep the existing calculator flow. Add a pure, dependency-free bisection solver in `script.js` that calls the existing `blackScholes()` pricing function with candidate volatility values, then render the result in a new Price card in `index.html`. MW remains a display scaling factor and is excluded from the inversion.

**Tech Stack:** Vanilla HTML, CSS, and JavaScript; browser DOM and Canvas APIs.

## Global Constraints

- Use the entered unit `Premium` as the implied-volatility target.
- Use the current option type, spot, strike, rates, dividend yield, and time to expiry.
- Keep MW out of the implied-volatility calculation.
- Display `-` for premiums outside the valid no-arbitrage range or when no positive solution exists.
- Reuse the existing `calculate()` input/change event flow.
- Do not add dependencies.

---

### Task 1: Add the implied-volatility calculation

**Files:**
- Modify: `script.js` near `blackScholes()` and `renderResults()`

**Interfaces:**
- Consumes: `{ type, S, K, r, q, T, premium }` values from `readInputs()`.
- Produces: `impliedVolatility(params)` returning a decimal volatility or `null`.

- [ ] **Step 1: Add a pure solver before `formatNumber()`**

Implement `impliedVolatility({ type, S, K, r, q, T, premium })` as follows:

```js
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
```

- [ ] **Step 2: Render the percentage**

In `renderResults(result, inputs)`, calculate `const iv = impliedVolatility(inputs);` and set `outIv` to `formatNumber(iv * 100, 2) + "%"` when `iv` is finite, otherwise `"-"`.

- [ ] **Step 3: Run a syntax check**

Run:

```powershell
node --check script.js
```

Expected: exit code `0`.

### Task 2: Add the result card and verify behavior

**Files:**
- Modify: `index.html` in the Price result cards

**Interfaces:**
- Consumes: the `outIv` DOM element updated by `renderResults()`.
- Produces: visible Implied Volatility result in the existing results panel.

- [ ] **Step 1: Add the result card**

Insert this card beside Option Price in the Price cards:

```html
<div class="card">
  <span class="label">Implied Volatility</span>
  <span class="value" id="outIv">-</span>
  <span class="hint">from premium input</span>
</div>
```

- [ ] **Step 2: Run a browser-level calculation check**

Serve the folder locally and use the calculator with a valid premium. Confirm the result panel contains `Implied Volatility` and a percentage value. Change MW and confirm the IV value does not change. Use a premium below intrinsic value and confirm IV displays `-` while the result panel remains visible.

- [ ] **Step 3: Review the final diff**

Run:

```powershell
git diff -- index.html script.js docs/superpowers/specs/2026-09-27-implied-volatility-design.md docs/superpowers/plans/2026-09-27-implied-volatility.md
```

Expected: only the requested UI, calculation, spec, and plan changes are present. This directory is currently not a Git repository, so the command may report that no repository is available.
