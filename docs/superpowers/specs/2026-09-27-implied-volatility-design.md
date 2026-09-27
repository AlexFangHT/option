# Implied Volatility Design

## Goal

Add implied volatility to the options calculator results, derived from the entered unit premium.

## Behavior

- Solve for the volatility that makes the Black-Scholes-Merton price equal to the unit `Premium` input.
- Use the current option type, spot, strike, risk-free rate, dividend yield, and time to expiry.
- Do not include MW in the inversion. MW continues to scale total price, Greeks, and MTM only.
- Display implied volatility as a percentage in the Price results group.
- Show `-` when the premium is outside the valid no-arbitrage range or no positive volatility solution can be found.
- Recalculate through the existing `calculate()` input and change listeners.

## Implementation

Add a dependency-free bounded bisection solver in `script.js`. The solver will compare a candidate Black-Scholes price with the target premium, expanding a safe upper volatility bound when needed and stopping when price or volatility precision is sufficient. The existing volatility input remains available for the model price and Greeks; implied volatility is an additional output derived from premium.

## Validation

Use a known Black-Scholes case whose price was generated with 20% volatility and verify the displayed implied volatility is approximately 20%. Also verify invalid premiums display `-` without hiding otherwise valid results.
