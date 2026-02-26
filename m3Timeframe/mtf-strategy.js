/**
 * MTF (Multiple Timeframe) Strategy Class
 * วิเคราะห์ 30M, 15M, 1M พร้อมกัน
 */
class MTFStrategy {
    constructor(indicators) {
        this.indicators = indicators;
        this.data = {
            tf30m: { candles: [], closes: [], highs: [], lows: [], opens: [], volumes: [] },
            tf15m: { candles: [], closes: [], highs: [], lows: [], opens: [], volumes: [] },
            tf1m: { candles: [], closes: [], highs: [], lows: [], opens: [], volumes: [] }
        };
        this.currentSignal = null;
        this.backtestResults = [];
    }

    /**
     * โหลดข้อมูลทั้ง 3 timeframes พร้อมกัน
     */
    async loadAllTimeframes(derivAPI, symbol) {
        console.log('🔄 Loading all timeframes...');

        try {
            const [candles30m, candles15m, candles1m] = await Promise.all([
                derivAPI.getHistoricalCandles(symbol, 1800, 500),  // 30M
                derivAPI.getHistoricalCandles(symbol, 900, 500),   // 15M
                derivAPI.getHistoricalCandles(symbol, 60, 500)     // 1M
            ]);

            // Format 30M
            this.prepareData('tf30m', candles30m);

            // Format 15M
            this.prepareData('tf15m', candles15m);

            // Format 1M
            this.prepareData('tf1m', candles1m);

            console.log('✅ All timeframes loaded');
            console.log(`30M: ${this.data.tf30m.candles.length} candles`);
            console.log(`15M: ${this.data.tf15m.candles.length} candles`);
            console.log(`1M: ${this.data.tf1m.candles.length} candles`);

            return true;
        } catch (error) {
            console.error('❌ Failed to load timeframes:', error);
            return false;
        }
    }

    prepareData(tf, rawCandles) {
        const candles = DerivAPI.formatCandles(rawCandles);
        this.data[tf] = {
            candles,
            closes: candles.map(c => c.close),
            highs: candles.map(c => c.high),
            lows: candles.map(c => c.low),
            opens: candles.map(c => c.open),
            volumes: candles.map(c => c.volume || 0)
        };
    }

    /**
     * Update data with real-time candle
     */
    updateCandle(tf, candle) {
        if (!this.data[tf]) return;

        const tfData = this.data[tf];
        const lastCandle = tfData.candles[tfData.candles.length - 1];

        if (lastCandle && candle.time === lastCandle.time) {
            // Update existing candle
            tfData.candles[tfData.candles.length - 1] = candle;
            tfData.closes[tfData.closes.length - 1] = candle.close;
            tfData.highs[tfData.highs.length - 1] = candle.high;
            tfData.lows[tfData.lows.length - 1] = candle.low;
            tfData.opens[tfData.opens.length - 1] = candle.open;
            tfData.volumes[tfData.volumes.length - 1] = candle.volume || 0;
        } else {
            // New candle
            tfData.candles.push(candle);
            tfData.closes.push(candle.close);
            tfData.highs.push(candle.high);
            tfData.lows.push(candle.low);
            tfData.opens.push(candle.open);
            tfData.volumes.push(candle.volume || 0);

            // Limit size
            if (tfData.candles.length > 2000) {
                tfData.candles.shift();
                tfData.closes.shift();
                tfData.highs.shift();
                tfData.lows.shift();
                tfData.opens.shift();
                tfData.volumes.shift();
            }
        }
    }

    /**
     * วิเคราะห์ 30M - Trend Direction
     */
    analyze30M() {
        const ema50 = this.indicators.calculateEMA(this.data.tf30m.closes, 50);
        const ema200 = this.indicators.calculateEMA(this.data.tf30m.closes, 200);
        const rsi = this.indicators.calculateRSI(this.data.tf30m.closes, 14);
        const choppy = this.indicators.calculateChoppiness(
            this.data.tf30m.highs,
            this.data.tf30m.lows,
            this.data.tf30m.closes,
            14
        );

        // Get last valid values (handle null from initial periods)
        const lastEMA50 = ema50[ema50.length - 1] ?? this.data.tf30m.closes[this.data.tf30m.closes.length - 1];
        const lastEMA200 = ema200[ema200.length - 1] ?? lastEMA50; // Fallback to EMA50 if 200 not ready
        const lastRSI = rsi[rsi.length - 1] ?? 50; // Neutral RSI as fallback
        const lastChoppy = choppy[choppy.length - 1] ?? 50; // Neutral choppiness
        const lastPrice = this.data.tf30m.closes[this.data.tf30m.closes.length - 1];

        const trend = lastEMA50 > lastEMA200 ? 'UPTREND' : 'DOWNTREND';
        const momentum = lastRSI > 50 ? 'BULLISH' : 'BEARISH';
        const isChoppy = lastChoppy > 61.8;
        const strength = Math.abs(lastEMA50 - lastEMA200) / lastEMA200 * 100;

        return {
            trend,
            momentum,
            isChoppy,
            strength,
            rsi: lastRSI,
            choppy: lastChoppy,
            price: lastPrice,
            ema50: lastEMA50,
            ema200: lastEMA200,
            indicators: { ema50, ema200, rsi, choppy }
        };
    }

    /**
     * วิเคราะห์ 15M - Structure / Setup
     */
    analyze15M() {
        const ema21 = this.indicators.calculateEMA(this.data.tf15m.closes, 21);
        const ema50 = this.indicators.calculateEMA(this.data.tf15m.closes, 50);
        const rsi = this.indicators.calculateRSI(this.data.tf15m.closes, 14);

        const lastPrice = this.data.tf15m.closes[this.data.tf15m.closes.length - 1];
        const lastEMA21 = ema21[ema21.length - 1] ?? lastPrice;
        const lastEMA50 = ema50[ema50.length - 1] ?? lastPrice;
        const lastRSI = rsi[rsi.length - 1] ?? 50;

        const distanceFromEMA21 = ((lastPrice - lastEMA21) / lastEMA21) * 100;

        // หา swing high/low ล่าสุด
        const swingHigh = Math.max(...this.data.tf15m.highs.slice(-20));
        const swingLow = Math.min(...this.data.tf15m.lows.slice(-20));

        // Pullback Checks
        const isPullback = Math.abs(distanceFromEMA21) < 1.0; // Widened slightly to catch more setups
        const isNearSupport = lastPrice < lastEMA21 && Math.abs(distanceFromEMA21) < 0.5;
        const isNearResistance = lastPrice > lastEMA21 && Math.abs(distanceFromEMA21) < 0.5;

        return {
            isPullback,
            isNearSupport,
            isNearResistance,
            supportLevel: lastEMA21,
            resistanceLevel: swingHigh,
            rsi: lastRSI,
            distanceFromEMA21,
            swingHigh,
            swingLow,
            price: lastPrice,
            indicators: { ema21, ema50, rsi }
        };
    }

    /**
     * วิเคราะห์ 1M - Entry Signal
     */
    analyze1M({ hmaShort = 20, hmaLong = 50 } = {}) {
        const rsi = this.indicators.calculateRSI(this.data.tf1m.closes, 14);
        const macd = this.calculateMACD(this.data.tf1m.closes);

        // Keep HMA for consistency with UI
        const hmaShortLine = this.calculateHMA(this.data.tf1m.closes, hmaShort);
        const hmaLongLine = this.calculateHMA(this.data.tf1m.closes, hmaLong);

        const lastRSI = rsi[rsi.length - 1] ?? 50;
        const prevRSI = rsi[rsi.length - 2] ?? 50;

        const lastCandle = this.data.tf1m.candles[this.data.tf1m.candles.length - 1];
        const prevCandle = this.data.tf1m.candles[this.data.tf1m.candles.length - 2];

        // Candlestick Patterns
        // Bullish Engulfing
        const isBullishEngulfing =
            prevCandle.close < prevCandle.open &&
            lastCandle.close > lastCandle.open &&
            lastCandle.close > prevCandle.open &&
            lastCandle.open < prevCandle.close;

        // Hammer
        const bodySize = Math.abs(lastCandle.close - lastCandle.open);
        const lowerWick = Math.min(lastCandle.close, lastCandle.open) - lastCandle.low;
        const upperWick = lastCandle.high - Math.max(lastCandle.close, lastCandle.open);
        const isHammer = bodySize > 0 && lowerWick > 2 * bodySize && upperWick < bodySize;

        // Bearish Engulfing
        const isBearishEngulfing =
            prevCandle.close > prevCandle.open &&
            lastCandle.close < lastCandle.open &&
            lastCandle.close < prevCandle.open &&
            lastCandle.open > prevCandle.close;

        // Shooting Star
        const isShootingStar = bodySize > 0 && upperWick > 2 * bodySize && lowerWick < bodySize;

        // RSI Conditions
        const isRSIOversold = lastRSI < 30;
        const isRSIOverbought = lastRSI > 70;
        const isRSIBounceUp30 = prevRSI < 30 && lastRSI > 30; // Crossed 30 up
        const isRSIBounceUp = lastRSI > prevRSI && lastRSI < 40; // Bouncing up low
        const isRSIBounceDown70 = prevRSI > 70 && lastRSI < 70;
        const isRSIBounceDown = lastRSI < prevRSI && lastRSI > 60; // Bouncing down high

        // MACD
        const macdHist = macd.histogram[macd.histogram.length - 1] ?? 0;
        const isMACDBullish = macdHist > 0;
        const isMACDBearish = macdHist < 0;

        return {
            rsi: lastRSI,
            prevRSI,
            isBullishEngulfing,
            isBearishEngulfing,
            isHammer,
            isShootingStar,
            isRSIBounceUp,
            isRSIBounceDown,
            isRSIBounceUp30,
            isRSIBounceDown70,
            isMACDBullish,
            isMACDBearish,
            price: lastCandle.close,
            indicators: { rsi, macd, hmaShort: hmaShortLine, hmaLong: hmaLongLine }
        };
    }

    /**
     * วิเคราะห์ตาม Quick Decision Table เป๊ะๆ
     * Ref: MTF-Trading-Signals-Quick-Reference.md
     */
    analyzeQuickDecisionTable(tf30m, tf15m, tf1m) {
        const trend30m = tf30m.trend;
        const rsi15m = tf15m.rsi;
        const rsi1m = tf1m.rsi;

        // 1. UPTREND | > 50 | < 30 | BUY
        if (trend30m === 'UPTREND' && rsi15m > 50 && rsi1m < 30) {
            return { action: 'BUY', risk: '⭐⭐⭐', condition: 'UPTREND | RSI15 > 50 | RSI1 < 30' };
        }

        // 2. DOWNTREND | < 50 | > 70 | SELL
        if (trend30m === 'DOWNTREND' && rsi15m < 50 && rsi1m > 70) {
            return { action: 'SELL', risk: '⭐⭐⭐', condition: 'DOWNTREND | RSI15 < 50 | RSI1 > 70' };
        }

        // 3. CHOPPY | 40-60 | 40-60 | IDLE
        if (tf30m.isChoppy && (rsi15m >= 40 && rsi15m <= 60) && (rsi1m >= 40 && rsi1m <= 60)) {
            return { action: 'IDLE', risk: '-', condition: 'CHOPPY | RSI15 40-60 | RSI1 40-60' };
        }

        // 4. ANY | < 30 | < 20 | IDLE (Extreme Oversold - Danger)
        if (rsi15m < 30 && rsi1m < 20) {
            return { action: 'IDLE', risk: '💀💀💀', condition: 'EXTREME OVERSOLD (Wait for bounce)' };
        }

        // 5. ANY | > 70 | > 80 | IDLE (Extreme Overbought - Danger)
        if (rsi15m > 70 && rsi1m > 80) {
            return { action: 'IDLE', risk: '🔥🔥🔥', condition: 'EXTREME OVERBOUGHT (Wait for drop)' };
        }

        // 6. UPTREND | > 60 | > 60 | BUY (Breakout/Strong Trend)
        if (trend30m === 'UPTREND' && rsi15m > 60 && rsi1m > 60) {
            return { action: 'BUY', risk: '⭐⭐', condition: 'STRONG UPTREND (Breakout potential)' };
        }

        // 7. DOWNTREND | < 40 | < 40 | SELL (Breakdown/Strong Trend)
        if (trend30m === 'DOWNTREND' && rsi15m < 40 && rsi1m < 40) {
            return { action: 'SELL', risk: '⭐⭐', condition: 'STRONG DOWNTREND (Breakdown potential)' };
        }

        // 8. CONFLICT
        return { action: 'IDLE', risk: '❌', condition: 'CONFLICT / NO CLEAR SETUP' };
    }

    /**
     * คำนวณ MACD
     */
    calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
        const emaFast = this.indicators.calculateEMA(prices, fast);
        const emaSlow = this.indicators.calculateEMA(prices, slow);

        const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
        const signalLine = this.indicators.calculateEMA(macdLine, signal);
        const histogram = macdLine.map((v, i) => v - signalLine[i]);

        return { macd: macdLine, signal: signalLine, histogram };
    }

    /**
     * สร้างสัญญาณเทรด
     */
    generateSignal(options = {}) {
        const tf30m = this.analyze30M();
        const tf15m = this.analyze15M();
        const tf1m = this.analyze1M(options);

        // ตรวจสอบ Quick Decision Table (เพื่อแสดงผลให้ User เห็นชัดเจน)
        const decisionMatch = this.analyzeQuickDecisionTable(tf30m, tf15m, tf1m);

        // ตรวจสอบ Choppy Market
        if (tf30m.isChoppy) {
            return {
                action: 'IDLE',
                confidence: 0,
                reason: 'Market is choppy (Choppiness > 61.8)',
                decisionTableMatch: decisionMatch,
                analysis: { tf30m, tf15m, tf1m }
            };
        }

        // -----------------------------------------------------------
        // 1. PULLBACK BUY (Safe)
        // -----------------------------------------------------------
        if (
            tf30m.trend === 'UPTREND' &&
            tf15m.rsi > 50 &&
            (tf1m.rsi < 35 && tf1m.isRSIBounceUp) // RSI dipped and bouncing
        ) {
            // Check pattern if available for better confidence
            const hasPattern = tf1m.isBullishEngulfing || tf1m.isHammer;
            const confidence = hasPattern ? 90 : 75;

            const entry = tf1m.price;
            const stopLoss = tf15m.supportLevel * 0.995; // -0.5%
            const takeProfit = entry + (entry - stopLoss) * 2; // R:R 1:2

            return {
                action: 'CALL',
                type: 'PULLBACK',
                confidence,
                entry, stopLoss, takeProfit,
                risk: entry - stopLoss,
                reward: takeProfit - entry,
                riskReward: 2,
                reason: `Pullback Buy: 30M Uptrend + 1M RSI dip (${tf1m.rsi.toFixed(1)})` + (hasPattern ? ' + Pattern' : ''),
                decisionTableMatch: decisionMatch,
                analysis: { tf30m, tf15m, tf1m }
            };
        }

        // -----------------------------------------------------------
        // 1. PULLBACK SELL (Safe)
        // -----------------------------------------------------------
        if (
            tf30m.trend === 'DOWNTREND' &&
            tf15m.rsi < 50 &&
            (tf1m.rsi > 65 && tf1m.isRSIBounceDown)
        ) {
            const hasPattern = tf1m.isBearishEngulfing || tf1m.isShootingStar;
            const confidence = hasPattern ? 90 : 75;

            const entry = tf1m.price;
            const stopLoss = tf15m.resistanceLevel * 1.005; // +0.5%
            const takeProfit = entry - (stopLoss - entry) * 2; // R:R 1:2

            return {
                action: 'PUT',
                type: 'PULLBACK',
                confidence,
                entry, stopLoss, takeProfit,
                risk: stopLoss - entry,
                reward: entry - takeProfit,
                riskReward: 2,
                reason: `Pullback Sell: 30M Downtrend + 1M RSI spike (${tf1m.rsi.toFixed(1)})` + (hasPattern ? ' + Pattern' : ''),
                decisionTableMatch: decisionMatch,
                analysis: { tf30m, tf15m, tf1m }
            };
        }

        // -----------------------------------------------------------
        // 2. REVERSAL BUY (Medium Risk)
        // -----------------------------------------------------------
        if (
            tf30m.trend === 'DOWNTREND' &&
            tf15m.rsi < 30 &&
            tf1m.rsi < 30 && tf1m.isRSIBounceUp &&
            (tf1m.isBullishEngulfing || tf1m.isHammer)
        ) {
            const entry = tf1m.price;
            const stopLoss = Math.min(tf1m.price, tf15m.swingLow) * 0.99;
            const takeProfit = entry + (entry - stopLoss) * 2;

            return {
                action: 'CALL',
                type: 'REVERSAL',
                confidence: 65,
                entry, stopLoss, takeProfit,
                risk: entry - stopLoss,
                reward: takeProfit - entry,
                riskReward: 2,
                reason: 'Reversal Buy: Oversold confirmation + Pattern',
                decisionTableMatch: decisionMatch,
                analysis: { tf30m, tf15m, tf1m }
            };
        }

        // -----------------------------------------------------------
        // 2. REVERSAL SELL (Medium Risk)
        // -----------------------------------------------------------
        if (
            tf30m.trend === 'UPTREND' &&
            tf15m.rsi > 70 &&
            tf1m.rsi > 70 && tf1m.isRSIBounceDown &&
            (tf1m.isBearishEngulfing || tf1m.isShootingStar)
        ) {
            const entry = tf1m.price;
            const stopLoss = Math.max(tf1m.price, tf15m.swingHigh) * 1.01;
            const takeProfit = entry - (stopLoss - entry) * 2;

            return {
                action: 'PUT',
                type: 'REVERSAL',
                confidence: 65,
                entry, stopLoss, takeProfit,
                risk: stopLoss - entry,
                reward: entry - takeProfit,
                riskReward: 2,
                reason: 'Reversal Sell: Overbought confirmation + Pattern',
                decisionTableMatch: decisionMatch,
                analysis: { tf30m, tf15m, tf1m }
            };
        }

        // IDLE
        return {
            action: 'IDLE',
            confidence: 0,
            reason: this.generateIdleReason(tf30m, tf15m, tf1m),
            decisionTableMatch: decisionMatch,
            analysis: { tf30m, tf15m, tf1m }
        };
    }

    /**
     * สร้างคำอธิบายเมื่อไม่มีสัญญาณ
     */
    generateIdleReason(tf30m, tf15m, tf1m) {
        const issues = [];
        if (tf30m.isChoppy) issues.push('Market Choppy');
        if (tf30m.trend === 'UPTREND' && tf15m.rsi < 50) issues.push('15M RSI Weak');
        if (tf30m.trend === 'DOWNTREND' && tf15m.rsi > 50) issues.push('15M RSI Strong');
        return issues.length > 0 ? issues.join(' | ') : 'Waiting for setup';
    }

    /**
     * Backtest Strategy (Simplified)
     */
    async runBacktest(options = {}) {
        // Backtesting requires more complex multi-timeframe synchronization
        // which is not fully implemented in this update.
        console.warn("Backtest temporarily disabled for 1M update");
        return {
            totalTrades: 0, winRate: 0, profitFactor: 0, netProfit: 0, returnPercent: 0, maxDrawdown: 0,
            trades: [], wins: 0, losses: 0
        };
    }

    /**
     * Calculate Weighted Moving Average (WMA)
     */
    calculateWMA(prices, period) {
        if (prices.length < period) return Array(prices.length).fill(null);

        const wma = [];
        const weights = period * (period + 1) / 2;

        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                wma.push(null);
                continue;
            }

            let sum = 0;
            let valid = true;
            for (let j = 0; j < period; j++) {
                const val = prices[i - period + 1 + j];
                if (val === null || val === undefined) {
                    valid = false;
                    break;
                }
                sum += val * (j + 1);
            }
            if (valid) wma.push(sum / weights);
            else wma.push(null);
        }
        return wma;
    }

    /**
     * Calculate Hull Moving Average (HMA)
     */
    calculateHMA(prices, period) {
        if (prices.length < period) return Array(prices.length).fill(null);

        const halfPeriod = Math.floor(period / 2);
        const wmaHalf = this.calculateWMA(prices, halfPeriod);
        const wmaFull = this.calculateWMA(prices, period);

        const diff = [];
        for (let i = 0; i < prices.length; i++) {
            if (wmaHalf[i] === null || wmaFull[i] === null) {
                diff.push(null);
            } else {
                diff.push(2 * wmaHalf[i] - wmaFull[i]);
            }
        }

        const sqrtPeriod = Math.floor(Math.sqrt(period));
        return this.calculateWMA(diff, sqrtPeriod);
    }
}