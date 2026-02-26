# Project Context: MTF Trading Strategy Dashboard

## Overview
The **MTF (Multiple Timeframe) Trading Strategy Dashboard** is a web-based trading application designed to analyze financial markets using a top-down approach across three timeframes: 30-Minute (Trend), 15-Minute (Structure), and 1-Minute/5-Minute (Entry). It leverages **GPU acceleration** via `gpu.js` for high-performance indicator calculations and visualizes data using `lightweight-charts`.

## Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+ Classes)
- **Visualization**: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) (v4.2.1)
- **Computation**: [GPU.js](https://github.com/gpujs/gpu.js) for WebGL acceleration
- **Data Source**: Deriv API (WebSocket) via `deriv-api.js`

## File Structure
- `mtf-dashboard.html`: Main entry point. Contains the **2-column UI layout** (Charts vs. Analysis), styles, and script loading order.
- `mtf-app.js`: Main application controller (`MTFApp` class). Handles initialization, UI events, signal updates, **Live Trading** logic, and coordinates components. NOW includes `updateQuickDecisionPanel` for the analysis rules.
- `webgpu-indicators.js`: (`WebGPUIndicators` class) Library for calculating technical indicators (RSI, SMA, EMA, Choppiness, True Range) using GPU kernels with automatic CPU fallback.
- `mtf-strategy.js`: (`MTFStrategy` class) Core trading logic. Generates signals, calculates indicators, and manages data. **Enhanced with null-safe indicator handling**.
- `mtf-chart-manager.js`: (`MTFChartManager` class) Manages charts, supports **Real-time updates**. **Enhanced with robust error handling and validation**.
- `deriv-api.js`: Wrapper for Deriv WebSocket API. Supports **Concurrent Subscriptions** and robust connection handling.
- `MTF-Trading-Signals-Quick-Reference.md`: Documentation for the Quick Decision Table rules used in the app.

## Key Features
1.  **Three-Timeframe Analysis**:
    *   **30M**: Trend direction (EMA50 vs EMA200), Momentum (RSI), Choppiness Index.
    *   **15M**: Market Structure, Support/Resistance levels, Pullback detection.
    *   **1M/5M**: Entry triggers (Engulfing patterns, MACD, RSI reversals, HMA Crossovers).
2.  **Interactive Dashboard**:
    *   **2-Column Layout**: Left column for charts, right column for detailed **Quick Decision Analysis**.
    *   **Quick Decision Table**: Real-time mapping of market conditions to specific trading rules with **Thai descriptions**.
    *   **Dynamic Checklist**: Auto-generates entry checklists (BUY/SELL/IDLE) based on the active signal.
    *   **Asset Display**: Clearly shows the currently analyzed asset.
3.  **Real-time Live Trading**:
    *   **Live Updates**: Subscribes to tick/candle data for all timeframes simultaneously.
    *   **Dynamic Charts**: Charts and analysis panel update in real-time without reloading.
4.  **Robust Error Handling**:
    *   Prevents crashes from "Value is null" or invalid candle data.
    *   Gracefully handles chart synchronization issues.

## Recent Changes & Fixes (Feb 2026)
-   **Dashboard Redesign**:
    *   Implemented a responsive **2-column layout** (Charts Left, Analysis Right).
    *   Added **Quick Decision Table Panel** that visually highlights the matching strategy rule.
    *   Added **Thai Language Support** for strategy explanations and checklists.
    *   Fixed panel overlapping and added sticky positioning for the analysis panel.
-   **Bug Fixes**:
    *   **"Value is null" Error**: Implemented comprehensive null checks and `try-catch` blocks in `mtf-chart-manager.js` and `mtf-strategy.js`. Added `??` operator default values for indicators.
    *   **Empty RSI Charts**: Changed RSI chart configuration from `autoScale: false` to `autoScale: true` and added `fitContent()` calls to ensure data visibility.
    *   **Chart Sync**: Fixed `subscribeVisibleTimeRangeChange` to handle null ranges gracefully.
-   **Code Quality**:
    *   Refactored `updateAllCharts` to include `isValidCandle` and `isValidValue` filters.
    *   Added explicit asset name display in the analysis header.

## Strategy Rules (Summary)
The application now strictly follows the **Quick Decision Table** (see `MTF-Trading-Signals-Quick-Reference.md`):
-   **PULLBACK BUY**: 30M Uptrend | 15M RSI > 50 | 1M RSI < 30 (Oversold).
-   **PULLBACK SELL**: 30M Downtrend | 15M RSI < 50 | 1M RSI > 70 (Overbought).
-   **IDLE**: Choppy markets, Extreme Oversold/Overbought without reversal, or Conflicting signals.

## Current State
-   The application is stable with **Live Trading** support.
-   Visual feedback is significantly improved with the new analysis panel.
-   Chart rendering issues (empty RSI, null errors) are resolved.
