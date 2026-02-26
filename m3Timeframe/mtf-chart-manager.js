/**
 * MTF Chart Manager
 * จัดการ 3 charts (30M, 15M, 1M) พร้อมกัน
 * + บันทึก/โหลด barSpacing & logicalRange จาก localStorage
 */
class MTFChartManager {
    constructor() {
        this.charts = {};
        this.series = {};
        this.STORAGE_KEY = 'mtf_chart_state';
        this.saveTimeout = {};
        this.initialize();
    }

    // ─────────────────────────────────────────────────────────────────
    // localStorage helpers
    // ─────────────────────────────────────────────────────────────────

    saveChartState(tf, barSpacing, logicalRange) {
        clearTimeout(this.saveTimeout[tf]);
        this.saveTimeout[tf] = setTimeout(() => {
            try {
                const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
                stored[tf] = { barSpacing, logicalRange, savedAt: Date.now() };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
                console.log(`[${tf}] 💾 saved state:`, stored[tf]);
            } catch (e) {
                console.warn(`[${tf}] save state error:`, e);
            }
        }, 500);
    }

    loadChartState(tf) {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
            return stored[tf] || null;
        } catch (e) {
            console.warn(`[${tf}] load state error:`, e);
            return null;
        }
    }

    applyChartState(tf, chartKey, rsiChartKey = null) {
        const state = this.loadChartState(tf);
        if (!state) {
            console.log(`[${tf}] ℹ️ no saved state found`);
            return;
        }

        const chart = this.charts[chartKey];
        if (!chart) return;

        try {
            if (state.barSpacing) {
                chart.timeScale().applyOptions({ barSpacing: state.barSpacing });
            }
            if (state.logicalRange) {
                chart.timeScale().setVisibleLogicalRange(state.logicalRange);
                if (rsiChartKey && this.charts[rsiChartKey]) {
                    this.charts[rsiChartKey].timeScale().setVisibleLogicalRange(state.logicalRange);
                }
            }
            console.log(`[${tf}] 📂 restored state:`, state);
        } catch (e) {
            console.warn(`[${tf}] apply state error:`, e);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // initialize
    // ─────────────────────────────────────────────────────────────────

    initialize() {
        // ── Chart 30M ────────────────────────────────────────────────
        this.charts.tf30m = LightweightCharts.createChart(document.getElementById('chart30m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: false },
            localization: {
                timeFormatter: (timestamp) => {
                    return new Date(timestamp * 1000).toLocaleTimeString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                }
            },
            height: 300
        });

        this.series.tf30m = {
            candles: this.charts.tf30m.addCandlestickSeries({
                upColor: '#00ff88', downColor: '#ff4444',
                borderUpColor: '#00ff88', borderDownColor: '#ff4444',
                wickUpColor: '#00ff88', wickDownColor: '#ff4444'
            }),
            ema50:  this.charts.tf30m.addLineSeries({ color: '#4a9eff', lineWidth: 2, title: 'EMA50' }),
            ema200: this.charts.tf30m.addLineSeries({ color: '#ff9500', lineWidth: 2, title: 'EMA200' })
        };

        // ── Chart RSI 30M ─────────────────────────────────────────────
        this.charts.rsi30m = LightweightCharts.createChart(document.getElementById('rsi30m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: false },
            localization: { timeFormatter: (ts) => new Date(ts * 1000).toLocaleTimeString('th-TH') },
            height: 150,
            rightPriceScale: { borderColor: '#2a3654', visible: true, autoScale: true }
        });
        this.charts.rsi30m.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
        this.series.rsi30m        = this.charts.rsi30m.addLineSeries({ color: '#f06292', lineWidth: 2, title: 'RSI' });
        this.series.rsi30mLevel70 = this.charts.rsi30m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '70' });
        this.series.rsi30mLevel30 = this.charts.rsi30m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '30' });

        // ── Chart 15M ────────────────────────────────────────────────
        this.charts.tf15m = LightweightCharts.createChart(document.getElementById('chart15m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: false },
            localization: {
                timeFormatter: (timestamp) => {
                    return new Date(timestamp * 1000).toLocaleTimeString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                }
            },
            height: 300
        });

        this.series.tf15m = {
            candles: this.charts.tf15m.addCandlestickSeries({
                upColor: '#00ff88', downColor: '#ff4444',
                borderUpColor: '#00ff88', borderDownColor: '#ff4444',
                wickUpColor: '#00ff88', wickDownColor: '#ff4444'
            }),
            ema21: this.charts.tf15m.addLineSeries({ color: '#4a9eff', lineWidth: 2, title: 'EMA21' }),
            ema50: this.charts.tf15m.addLineSeries({ color: '#ff9500', lineWidth: 2, title: 'EMA50' })
        };

        // ── Chart RSI 15M ─────────────────────────────────────────────
        this.charts.rsi15m = LightweightCharts.createChart(document.getElementById('rsi15m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: false },
            localization: { timeFormatter: (ts) => new Date(ts * 1000).toLocaleTimeString('th-TH') },
            height: 150,
            rightPriceScale: { borderColor: '#2a3654', visible: true, autoScale: true }
        });
        this.charts.rsi15m.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
        this.series.rsi15m        = this.charts.rsi15m.addLineSeries({ color: '#f06292', lineWidth: 2, title: 'RSI' });
        this.series.rsi15mLevel70 = this.charts.rsi15m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '70' });
        this.series.rsi15mLevel30 = this.charts.rsi15m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '30' });

        // ── Chart 1M ─────────────────────────────────────────────────
        this.charts.tf1m = LightweightCharts.createChart(document.getElementById('chart1m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: true },
            localization: {
                timeFormatter: (timestamp) => {
                    return new Date(timestamp * 1000).toLocaleTimeString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    });
                }
            },
            height: 300
        });

        this.series.tf1m = {
            candles: this.charts.tf1m.addCandlestickSeries({
                upColor: '#00ff88', downColor: '#ff4444',
                borderUpColor: '#00ff88', borderDownColor: '#ff4444',
                wickUpColor: '#00ff88', wickDownColor: '#ff4444'
            }),
            hmaShort: this.charts.tf1m.addLineSeries({ color: '#00d4ff', lineWidth: 2, title: 'HMA Short' }),
            hmaLong:  this.charts.tf1m.addLineSeries({ color: '#e91e63', lineWidth: 2, title: 'HMA Long' })
        };

        // ── Chart RSI 1M ──────────────────────────────────────────────
        this.charts.rsi1m = LightweightCharts.createChart(document.getElementById('rsi1m'), {
            layout: { background: { color: '#0f1729' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1a2340' }, horzLines: { color: '#1a2340' } },
            timeScale: { timeVisible: true, secondsVisible: true },
            localization: {
                timeFormatter: (timestamp) => {
                    return new Date(timestamp * 1000).toLocaleTimeString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    });
                }
            },
            height: 150,
            rightPriceScale: { borderColor: '#2a3654', visible: true, autoScale: true },
            leftPriceScale:  { visible: false }
        });
        this.charts.rsi1m.priceScale('right').applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
            mode: LightweightCharts.PriceScaleMode.Normal,
        });
        this.series.rsi1m        = this.charts.rsi1m.addLineSeries({ color: '#f06292', lineWidth: 2, title: 'RSI' });
        this.series.rsi1mLevel70 = this.charts.rsi1m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '70' });
        this.series.rsi1mLevel30 = this.charts.rsi1m.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, title: '30' });

        // ── Subscribe + Save state ────────────────────────────────────

        this.charts.tf30m.timeScale().subscribeVisibleTimeRangeChange((range) => {
            try {
                if (range && range.from !== null && range.to !== null) {
                    const barSpacing   = this.charts.tf30m.timeScale().options().barSpacing;
                    const logicalRange = this.charts.tf30m.timeScale().getVisibleLogicalRange();
                    console.log('[30M] barSpacing:', barSpacing, '| logicalRange:', logicalRange);
                    this.saveChartState('tf30m', barSpacing, logicalRange);
                    this.charts.rsi30m.timeScale().setVisibleRange(range);
                }
            } catch (e) { /* ignore sync errors */ }
        });

        this.charts.tf15m.timeScale().subscribeVisibleTimeRangeChange((range) => {
            try {
                if (range && range.from !== null && range.to !== null) {
                    const barSpacing   = this.charts.tf15m.timeScale().options().barSpacing;
                    const logicalRange = this.charts.tf15m.timeScale().getVisibleLogicalRange();
                    console.log('[15M] barSpacing:', barSpacing, '| logicalRange:', logicalRange);
                    this.saveChartState('tf15m', barSpacing, logicalRange);
                    this.charts.rsi15m.timeScale().setVisibleRange(range);
                }
            } catch (e) { /* ignore sync errors */ }
        });

        this.charts.tf1m.timeScale().subscribeVisibleTimeRangeChange((range) => {
            try {
                if (range && range.from !== null && range.to !== null) {
                    const barSpacing   = this.charts.tf1m.timeScale().options().barSpacing;
                    const logicalRange = this.charts.tf1m.timeScale().getVisibleLogicalRange();
                    console.log('[1M] barSpacing:', barSpacing, '| logicalRange:', logicalRange);
                    this.saveChartState('tf1m', barSpacing, logicalRange);
                    this.charts.rsi1m.timeScale().setVisibleRange(range);
                }
            } catch (e) { /* ignore sync errors */ }
        });

        console.log('✅ MTF Charts initialized (30M, 15M, 1M) + RSI');
    }

    // ─────────────────────────────────────────────────────────────────
    // updateAllCharts
    // ─────────────────────────────────────────────────────────────────

    updateAllCharts(mtfData, analysis) {
        const isValidValue  = (d) => d.value !== null && d.value !== undefined && !isNaN(d.value);
        const isValidCandle = (c) => c && c.time && c.open !== null && c.high !== null && c.low !== null && c.close !== null;

        try {
            // ── 30M ──────────────────────────────────────────────────
            const candles30m = mtfData.tf30m.candles.filter(isValidCandle);
            this.series.tf30m.candles.setData(candles30m);

            if (analysis.tf30m && analysis.tf30m.indicators) {
                const ema50Data  = analysis.tf30m.indicators.ema50.map((v, i) => ({ time: mtfData.tf30m.candles[i].time, value: v })).filter(isValidValue);
                const ema200Data = analysis.tf30m.indicators.ema200.map((v, i) => ({ time: mtfData.tf30m.candles[i].time, value: v })).filter(isValidValue);
                this.series.tf30m.ema50.setData(ema50Data);
                this.series.tf30m.ema200.setData(ema200Data);

                if (analysis.tf30m.indicators.rsi) {
                    const rsiData = analysis.tf30m.indicators.rsi
                        .map((v, i) => ({ time: mtfData.tf30m.candles[i].time, value: v }))
                        .filter(isValidValue);
                    console.log('RSI 30M data points:', rsiData.length, rsiData.slice(-3));
                    this.series.rsi30m.setData(rsiData);
                    if (rsiData.length > 0) {
                        this.series.rsi30mLevel70.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
                        this.series.rsi30mLevel30.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
                    }
                    this.charts.rsi30m.timeScale().fitContent();
                }
            }
            this.charts.tf30m.timeScale().fitContent();

            // ── 15M ──────────────────────────────────────────────────
            const candles15m = mtfData.tf15m.candles.filter(isValidCandle);
            this.series.tf15m.candles.setData(candles15m);

            if (analysis.tf15m && analysis.tf15m.indicators) {
                const ema21Data = analysis.tf15m.indicators.ema21.map((v, i) => ({ time: mtfData.tf15m.candles[i].time, value: v })).filter(isValidValue);
                const ema50Data = analysis.tf15m.indicators.ema50.map((v, i) => ({ time: mtfData.tf15m.candles[i].time, value: v })).filter(isValidValue);
                this.series.tf15m.ema21.setData(ema21Data);
                this.series.tf15m.ema50.setData(ema50Data);

                if (analysis.tf15m.indicators.rsi) {
                    const rsiData = analysis.tf15m.indicators.rsi
                        .map((v, i) => ({ time: mtfData.tf15m.candles[i].time, value: v }))
                        .filter(isValidValue);
                    this.series.rsi15m.setData(rsiData);
                    if (rsiData.length > 0) {
                        this.series.rsi15mLevel70.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
                        this.series.rsi15mLevel30.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
                    }
                    this.charts.rsi15m.timeScale().fitContent();
                }
            }
            this.charts.tf15m.timeScale().fitContent();

            // ── 1M ───────────────────────────────────────────────────
            const candles1m = mtfData.tf1m.candles.filter(isValidCandle);
            this.series.tf1m.candles.setData(candles1m);

            if (analysis.tf1m && analysis.tf1m.indicators) {
                if (analysis.tf1m.indicators.hmaShort) {
                    const hmaShortData = analysis.tf1m.indicators.hmaShort
                        .map((v, i) => ({ time: mtfData.tf1m.candles[i].time, value: v }))
                        .filter(isValidValue);
                    this.series.tf1m.hmaShort.setData(hmaShortData);
                }
                if (analysis.tf1m.indicators.hmaLong) {
                    const hmaLongData = analysis.tf1m.indicators.hmaLong
                        .map((v, i) => ({ time: mtfData.tf1m.candles[i].time, value: v }))
                        .filter(isValidValue);
                    this.series.tf1m.hmaLong.setData(hmaLongData);
                }
                if (analysis.tf1m.indicators.rsi) {
                    const rsiData = analysis.tf1m.indicators.rsi
                        .map((v, i) => ({ time: mtfData.tf1m.candles[i].time, value: v }))
                        .filter(isValidValue);
                    this.series.rsi1m.setData(rsiData);
                    if (rsiData.length > 0) {
                        this.series.rsi1mLevel70.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
                        this.series.rsi1mLevel30.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
                    }
                    this.charts.rsi1m.timeScale().fitContent();
                }
            }
            this.charts.tf1m.timeScale().fitContent();

            // ── Restore localStorage state หลัง fitContent ───────────
            // delay 100ms เพื่อให้ fitContent render เสร็จก่อน
            setTimeout(() => {
                this.applyChartState('tf30m', 'tf30m', 'rsi30m');
                this.applyChartState('tf15m', 'tf15m', 'rsi15m');
                this.applyChartState('tf1m',  'tf1m',  'rsi1m');
            }, 100);

        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // updateCandle (Real-time)
    // ─────────────────────────────────────────────────────────────────

    updateCandle(tf, candle, analysis) {
        const series = this.series[tf];
        if (!series) return;

        series.candles.update(candle);

        if (analysis && analysis.indicators) {
            // ── 30M ──────────────────────────────────────────────────
            if (tf === 'tf30m') {
                if (series.ema50 && analysis.indicators.ema50) {
                    const val = Array.isArray(analysis.indicators.ema50)
                        ? analysis.indicators.ema50[analysis.indicators.ema50.length - 1]
                        : analysis.ema50;
                    if (val !== undefined) series.ema50.update({ time: candle.time, value: val });
                }
                if (series.ema200 && analysis.indicators.ema200) {
                    const val = Array.isArray(analysis.indicators.ema200)
                        ? analysis.indicators.ema200[analysis.indicators.ema200.length - 1]
                        : analysis.ema200;
                    if (val !== undefined) series.ema200.update({ time: candle.time, value: val });
                }
                if (this.series.rsi30m && analysis.indicators.rsi) {
                    const rsiVal = Array.isArray(analysis.indicators.rsi)
                        ? analysis.indicators.rsi[analysis.indicators.rsi.length - 1]
                        : analysis.rsi;
                    if (rsiVal !== undefined) {
                        this.series.rsi30m.update({ time: candle.time, value: rsiVal });
                        this.series.rsi30mLevel70.update({ time: candle.time, value: 70 });
                        this.series.rsi30mLevel30.update({ time: candle.time, value: 30 });
                    }
                }
            }
            // ── 15M ──────────────────────────────────────────────────
            else if (tf === 'tf15m') {
                if (series.ema21 && analysis.indicators.ema21) {
                    const lastIdx = analysis.indicators.ema21.length - 1;
                    series.ema21.update({ time: candle.time, value: analysis.indicators.ema21[lastIdx] });
                }
                if (series.ema50 && analysis.indicators.ema50) {
                    const lastIdx = analysis.indicators.ema50.length - 1;
                    series.ema50.update({ time: candle.time, value: analysis.indicators.ema50[lastIdx] });
                }
                if (this.series.rsi15m && analysis.indicators.rsi) {
                    const lastIdx = analysis.indicators.rsi.length - 1;
                    this.series.rsi15m.update({ time: candle.time, value: analysis.indicators.rsi[lastIdx] });
                    this.series.rsi15mLevel70.update({ time: candle.time, value: 70 });
                    this.series.rsi15mLevel30.update({ time: candle.time, value: 30 });
                }
            }
            // ── 1M ───────────────────────────────────────────────────
            else if (tf === 'tf1m') {
                if (series.hmaShort && analysis.indicators.hmaShort) {
                    const lastIdx = analysis.indicators.hmaShort.length - 1;
                    series.hmaShort.update({ time: candle.time, value: analysis.indicators.hmaShort[lastIdx] });
                }
                if (series.hmaLong && analysis.indicators.hmaLong) {
                    const lastIdx = analysis.indicators.hmaLong.length - 1;
                    series.hmaLong.update({ time: candle.time, value: analysis.indicators.hmaLong[lastIdx] });
                }
                if (this.series.rsi1m && analysis.indicators.rsi) {
                    const lastIdx = analysis.indicators.rsi.length - 1;
                    this.series.rsi1m.update({ time: candle.time, value: analysis.indicators.rsi[lastIdx] });
                    this.series.rsi1mLevel70.update({ time: candle.time, value: 70 });
                    this.series.rsi1mLevel30.update({ time: candle.time, value: 30 });
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // addSignalMarkers
    // ─────────────────────────────────────────────────────────────────

    addSignalMarkers(signal, tf) {
        // Implementation pending marker logic correction
    }
}