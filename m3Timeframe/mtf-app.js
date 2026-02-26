/**
 * MTF Trading App Controller
 */
class MTFApp {
    constructor() {
        this.derivAPI = null;
        this.indicators = null;
        this.strategy = null;
        this.chartManager = null;
        this.currentSignal = null;
        this.isLive = false;
        this.init();
    }

    getAnalysisOptions() {
        return {
            hmaShort: parseInt(document.getElementById('hmaShortInput').value) || 20,
            hmaLong: parseInt(document.getElementById('hmaLongInput').value) || 50
        };
    }

    async init() {
        try {
            // Initialize components
            this.indicators = new WebGPUIndicators();
            await this.indicators.ensureInitialized();
            this.updateGPUStatus();

            this.chartManager = new MTFChartManager();
            this.strategy = new MTFStrategy(this.indicators);

            this.derivAPI = new DerivAPI('1089');
            await this.derivAPI.connect();

            this.setupEventListeners();

            console.log('✅ MTF App initialized');
        } catch (error) {
            this.showError('Initialization failed: ' + error.message);
        }
    }

    updateGPUStatus() {
        const status = this.indicators.getGPUStatus();
        const statusEl = document.getElementById('gpuStatus');
        statusEl.textContent = status.displayText;
        statusEl.className = 'gpu-status ' + status.mode;
    }

    setupEventListeners() {
        document.getElementById('loadDataBtn').addEventListener('click', () => this.loadData());
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyze());
        document.getElementById('backtestBtn').addEventListener('click', () => this.runBacktest());
        document.getElementById('startLiveBtn').addEventListener('click', () => this.startLive());
        document.getElementById('stopLiveBtn').addEventListener('click', () => this.stopLive());
    }

    async loadData() {
        const symbol = document.getElementById('symbolSelect').value;
        this.showLoading('Loading data for all timeframes...');

        try {
            const success = await this.strategy.loadAllTimeframes(this.derivAPI, symbol);

            if (success) {
                this.updateCharts();
                this.enableButtons();
                this.clearLoading();

                // Update asset name display
                const assetNameDisplay = document.getElementById('assetNameDisplay');
                if (assetNameDisplay) {
                    const symbolSelect = document.getElementById('symbolSelect');
                    const selectedOption = symbolSelect.options[symbolSelect.selectedIndex];
                    assetNameDisplay.textContent = selectedOption.text;
                }

                // Auto analyze
                this.analyze();
                return true;
            } else {
                this.showError('Failed to load data');
                return false;
            }
        } catch (error) {
            this.showError('Error loading data: ' + error.message);
            return false;
        }
    }

    updateCharts() {
        const signal = this.strategy.generateSignal(this.getAnalysisOptions());
        this.chartManager.updateAllCharts(this.strategy.data, signal.analysis);

        // Update status
        document.getElementById('status30m').textContent =
            `${signal.analysis.tf30m.trend} | RSI: ${signal.analysis.tf30m.rsi.toFixed(1)}`;
        document.getElementById('status15m').textContent =
            `Pullback: ${signal.analysis.tf15m.isPullback ? 'Yes' : 'No'}`;
        document.getElementById('status1m').textContent =
            `RSI: ${signal.analysis.tf1m.rsi.toFixed(1)}`; // Use 1M RSI for status
    }

    analyze() {
        const signal = this.strategy.generateSignal(this.getAnalysisOptions());
        this.currentSignal = signal;

        this.updateSignalDisplay(signal);
        this.updateAnalysisPanel(signal.analysis);
    }

    updateSignalDisplay(signal) {
        const signalBox = document.getElementById('signalBox');
        const signalAction = document.getElementById('signalAction');
        const signalReason = document.getElementById('signalReason');
        const signalDetails = document.getElementById('signalDetails');

        // Update box style
        signalBox.className = `signal-box ${signal.action}`;
        signalAction.className = `signal-title ${signal.action}`;
        signalAction.textContent = signal.action;

        // Show Decision Table Status
        const decision = signal.decisionTableMatch;
        let decisionHtml = '';
        if (decision) {
            let color = '#e0e0e0';
            if (decision.action === 'BUY') color = '#00ff88';
            if (decision.action === 'SELL') color = '#ff4444';

            decisionHtml = `
            <div style="background: #0f1729; padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #2a3654; text-align: left;">
                <div style="font-size: 11px; color: #8b9dc3; text-transform: uppercase;">Quick Decision (Ref Table):</div>
                <div style="font-size: 16px; font-weight: bold; color: ${color}; margin: 5px 0;">
                    ${decision.action}
                </div>
                <div style="font-size: 12px; color: #aaa;">Condition: ${decision.condition}</div>
                <div style="font-size: 12px; color: #ff9500;">Risk: ${decision.risk}</div>
            </div>`;
        }

        signalReason.innerHTML = decisionHtml + `<div style="margin-top: 10px; color: #ccc;">${signal.reason}</div>`;

        // Update details
        if (signal.action !== 'IDLE') {
            signalDetails.innerHTML = `
                <div class="signal-detail">
                    <div class="signal-label">Confidence</div>
                    <div class="signal-value">${signal.confidence}%</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">Entry</div>
                    <div class="signal-value">${signal.entry.toFixed(4)}</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">Stop Loss</div>
                    <div class="signal-value">${signal.stopLoss.toFixed(4)}</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">Take Profit</div>
                    <div class="signal-value">${signal.takeProfit.toFixed(4)}</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">Risk</div>
                    <div class="signal-value">${signal.risk.toFixed(4)}</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">Reward</div>
                    <div class="signal-value">${signal.reward.toFixed(4)}</div>
                </div>
                <div class="signal-detail">
                    <div class="signal-label">R:R</div>
                    <div class="signal-value">1:${signal.riskReward.toFixed(2)}</div>
                </div>
            `;
        } else {
            signalDetails.innerHTML = '';
        }

        // Play alert sound if signal
        if (signal.action !== 'IDLE' && this.isLive) {
            this.playAlert();
        }
    }

    updateAnalysisPanel(analysis) {
        const panel = document.getElementById('analysisPanel');
        const grid = document.getElementById('analysisGrid');

        panel.style.display = 'block';

        grid.innerHTML = `
            <div class="analysis-card">
                <div class="analysis-tf">30M - Trend</div>
                <div class="analysis-items">
                    <div class="analysis-item">
                        <span class="analysis-item-label">Trend:</span>
                        <span class="analysis-item-value">${analysis.tf30m.trend}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Momentum:</span>
                        <span class="analysis-item-value">${analysis.tf30m.momentum}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">RSI:</span>
                        <span class="analysis-item-value">${analysis.tf30m.rsi.toFixed(1)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Choppy:</span>
                        <span class="analysis-item-value">${analysis.tf30m.choppy.toFixed(1)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Strength:</span>
                        <span class="analysis-item-value">${analysis.tf30m.strength.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-card">
                <div class="analysis-tf">15M - Structure</div>
                <div class="analysis-items">
                    <div class="analysis-item">
                        <span class="analysis-item-label">Pullback:</span>
                        <span class="analysis-item-value">${analysis.tf15m.isPullback ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Support:</span>
                        <span class="analysis-item-value">${analysis.tf15m.supportLevel.toFixed(4)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Distance EMA21:</span>
                        <span class="analysis-item-value">${analysis.tf15m.distanceFromEMA21.toFixed(2)}%</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Swing High:</span>
                        <span class="analysis-item-value">${analysis.tf15m.swingHigh.toFixed(4)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Swing Low:</span>
                        <span class="analysis-item-value">${analysis.tf15m.swingLow.toFixed(4)}</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-card">
                <div class="analysis-tf">1M - Entry</div>
                <div class="analysis-items">
                    <div class="analysis-item">
                        <span class="analysis-item-label">RSI:</span>
                        <span class="analysis-item-value">${analysis.tf1m.rsi.toFixed(1)}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Bullish Ptn:</span>
                        <span class="analysis-item-value">${analysis.tf1m.isBullishEngulfing ? 'Engulfing' : (analysis.tf1m.isHammer ? 'Hammer' : 'None')}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">Bearish Ptn:</span>
                        <span class="analysis-item-value">${analysis.tf1m.isBearishEngulfing ? 'Engulfing' : (analysis.tf1m.isShootingStar ? 'ShootingStar' : 'None')}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-item-label">MACD:</span>
                        <span class="analysis-item-value">${analysis.tf1m.isMACDBullish ? 'Bullish' : 'Bearish'}</span>
                    </div>
                </div>
            </div>
        `;

        // Also update the Quick Decision Panel
        this.updateQuickDecisionPanel(analysis);
    }

    updateQuickDecisionPanel(analysis) {
        // Update current values display
        const val30mTrend = document.getElementById('val30mTrend');
        const val15mRSI = document.getElementById('val15mRSI');
        const val1mRSI = document.getElementById('val1mRSI');
        const val30mChoppy = document.getElementById('val30mChoppy');

        if (val30mTrend) {
            const trendColor = analysis.tf30m.trend === 'UPTREND' ? '#00ff88' : '#ff4444';
            val30mTrend.innerHTML = `<span style="color:${trendColor}">${analysis.tf30m.trend}</span>`;
        }
        if (val15mRSI) val15mRSI.textContent = analysis.tf15m.rsi.toFixed(1);
        if (val1mRSI) val1mRSI.textContent = analysis.tf1m.rsi.toFixed(1);
        if (val30mChoppy) {
            const choppyColor = analysis.tf30m.choppy > 61.8 ? '#ff9500' : '#00ff88';
            val30mChoppy.innerHTML = `<span style="color:${choppyColor}">${analysis.tf30m.choppy.toFixed(1)}</span>`;
        }

        // Quick Decision Table - Full rows with Thai descriptions
        const tableRows = [
            { tf30m: 'UPTREND', rsi15: '> 50', rsi1: '< 30', action: '🟢 BUY', risk: '⭐⭐⭐', desc: 'PULLBACK BUY (ปลอดภัยสุด) - ตลาดขาขึ้น, RSI 15M ยืนยันโมเมนตัม, RSI 1M oversold พร้อมเด้ง', check: () => analysis.tf30m.trend === 'UPTREND' && analysis.tf15m.rsi > 50 && analysis.tf1m.rsi < 30 },
            { tf30m: 'DOWNTREND', rsi15: '< 50', rsi1: '> 70', action: '🔴 SELL', risk: '⭐⭐⭐', desc: 'PULLBACK SELL (ปลอดภัยสุด) - ตลาดขาลง, RSI 15M ยืนยันโมเมนตัม, RSI 1M overbought พร้อมย่อ', check: () => analysis.tf30m.trend === 'DOWNTREND' && analysis.tf15m.rsi < 50 && analysis.tf1m.rsi > 70 },
            { tf30m: 'CHOPPY', rsi15: '40-60', rsi1: '40-60', action: '⏸️ IDLE', risk: '-', desc: 'SIDEWAYS MARKET (สับสน) - ตลาดไม่มีทิศทาง Choppiness > 61.8', check: () => analysis.tf30m.isChoppy && analysis.tf15m.rsi >= 40 && analysis.tf15m.rsi <= 60 && analysis.tf1m.rsi >= 40 && analysis.tf1m.rsi <= 60 },
            { tf30m: 'ANY', rsi15: '< 30', rsi1: '< 20', action: '⏸️ IDLE', risk: '💀💀💀', desc: 'EXTREME OVERSOLD (ลงนรก) - "จับมีดตก" อันตรายมาก! รอ RSI 1M > 30 + Pattern ก่อน', check: () => analysis.tf15m.rsi < 30 && analysis.tf1m.rsi < 20 },
            { tf30m: 'ANY', rsi15: '> 70', rsi1: '> 80', action: '⏸️ IDLE', risk: '🔥🔥🔥', desc: 'EXTREME OVERBOUGHT (ร้อนเกิน) - ราคาร้อนเกิน อาจพักตัว ควร Take Profit', check: () => analysis.tf15m.rsi > 70 && analysis.tf1m.rsi > 80 },
            { tf30m: 'UPTREND', rsi15: '> 60', rsi1: '> 60', action: '🟢 BUY', risk: '⭐⭐', desc: 'BREAKOUT BUY (เสี่ยงปานกลาง) - โมเมนตัมแรง รอ Breakout Resistance + Volume spike', check: () => analysis.tf30m.trend === 'UPTREND' && analysis.tf15m.rsi > 60 && analysis.tf1m.rsi > 60 },
            { tf30m: 'DOWNTREND', rsi15: '< 40', rsi1: '< 40', action: '🔴 SELL', risk: '⭐⭐', desc: 'BREAKDOWN SELL (เสี่ยงปานกลาง) - โมเมนตัมแรง รอ Breakdown Support + Volume spike', check: () => analysis.tf30m.trend === 'DOWNTREND' && analysis.tf15m.rsi < 40 && analysis.tf1m.rsi < 40 },
            { tf30m: 'CONFLICT', rsi15: 'ANY', rsi1: 'ANY', action: '⏸️ IDLE', risk: '❌', desc: 'CONFLICTING SIGNALS (ขัดแย้ง) - Timeframes ไม่สอดคล้องกัน รอให้ชัดเจนก่อน', check: () => false }
        ];

        // Build table body with highlight
        let matchedRule = null;
        const tableBody = document.getElementById('decisionTableBody');
        if (tableBody) {
            let html = '';
            for (const row of tableRows) {
                const isMatch = row.check();
                if (isMatch && !matchedRule) {
                    matchedRule = row;
                }
                const rowBg = isMatch ? 'background: rgba(74, 158, 255, 0.3); border-left: 3px solid #4a9eff;' : '';
                html += `<tr style="${rowBg}">
                    <td style="padding: 6px; border: 1px solid #2a3654; color: #e0e0e0; text-align: center;">${row.tf30m}</td>
                    <td style="padding: 6px; border: 1px solid #2a3654; color: #e0e0e0; text-align: center;">${row.rsi15}</td>
                    <td style="padding: 6px; border: 1px solid #2a3654; color: #e0e0e0; text-align: center;">${row.rsi1}</td>
                    <td style="padding: 6px; border: 1px solid #2a3654; color: ${row.action.includes('BUY') ? '#00ff88' : row.action.includes('SELL') ? '#ff4444' : '#ff9500'}; text-align: center; font-weight: bold;">${row.action}</td>
                    <td style="padding: 6px; border: 1px solid #2a3654; color: #e0e0e0; text-align: center;">${row.risk}</td>
                </tr>`;
            }
            tableBody.innerHTML = html;
        }

        // Update matched rule details
        const matchedRuleContent = document.getElementById('matchedRuleContent');
        if (matchedRuleContent) {
            if (matchedRule) {
                matchedRuleContent.innerHTML = `
                    <div style="font-size: 16px; font-weight: bold; color: ${matchedRule.action.includes('BUY') ? '#00ff88' : matchedRule.action.includes('SELL') ? '#ff4444' : '#ff9500'}; margin-bottom:10px;">
                        ${matchedRule.action} ${matchedRule.risk}
                    </div>
                    <div style="font-size: 14px; color: #e0e0e0;">
                        ${matchedRule.desc}
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: #151d2e; border-radius: 6px; font-size: 12px;">
                        <strong style="color: #4a9eff;">เงื่อนไข:</strong> 30M: ${matchedRule.tf30m} | 15M RSI: ${matchedRule.rsi15} | 1M RSI: ${matchedRule.rsi1}
                    </div>
                `;
            } else {
                matchedRuleContent.innerHTML = `<div style="color: #8b9dc3;">ไม่พบกฎที่ตรงกับสถานการณ์ปัจจุบัน - รอดูสถานการณ์</div>`;
            }
        }

        // Update checklist based on action
        const checklistContent = document.getElementById('checklistContent');
        if (checklistContent && matchedRule) {
            if (matchedRule.action.includes('BUY')) {
                checklistContent.innerHTML = `
                    <div>☐ TF 30M = UPTREND (EMA50 > EMA200)</div>
                    <div>☐ TF 30M Choppiness < 61.8</div>
                    <div>☐ TF 15M RSI > 50</div>
                    <div>☐ TF 1M RSI < 30 → เด้งขึ้น</div>
                    <div>☐ มี Bullish Pattern (Engulfing/Hammer/Pin Bar)</div>
                    <div>☐ ราคาใกล้ Support ของ TF 15M (EMA21)</div>
                    <div>☐ Volume เพิ่มขึ้น</div>
                    <div style="margin-top:10px; color:#ff9500;">⚠️ Set Stop Loss ใต้ Support (-0.5%)</div>
                    <div style="color:#00ff88;">🎯 Take Profit: R:R = 1:2</div>
                `;
            } else if (matchedRule.action.includes('SELL')) {
                checklistContent.innerHTML = `
                    <div>☐ TF 30M = DOWNTREND (EMA50 < EMA200)</div>
                    <div>☐ TF 30M Choppiness < 61.8</div>
                    <div>☐ TF 15M RSI < 50</div>
                    <div>☐ TF 1M RSI > 70 → ย่อลง</div>
                    <div>☐ มี Bearish Pattern (Engulfing/Shooting Star/Pin Bar)</div>
                    <div>☐ ราคาใกล้ Resistance ของ TF 15M</div>
                    <div>☐ Volume เพิ่มขึ้น</div>
                    <div style="margin-top:10px; color:#ff9500;">⚠️ Set Stop Loss เหนือ Resistance (+0.5%)</div>
                    <div style="color:#00ff88;">🎯 Take Profit: R:R = 1:2</div>
                `;
            } else {
                checklistContent.innerHTML = `
                    <div style="color:#ff9500;">⏸️ <strong>ห้ามเทรด!</strong></div>
                    <div style="margin-top:10px;">รอให้เงื่อนไขครบก่อน:</div>
                    <div>• Trend ชัดเจน (ไม่ Choppy)</div>
                    <div>• RSI ทุก Timeframe สอดคล้องกัน</div>
                    <div>• มี Pattern ยืนยัน</div>
                `;
            }
        }
    }

    async runBacktest() {
        this.showLoading('Running backtest...');

        try {
            const results = await this.strategy.runBacktest({
                initialBalance: 10000,
                riskPercentage: 1
            });

            this.displayBacktestResults(results);
            this.clearLoading();
        } catch (error) {
            this.showError('Backtest failed: ' + error.message);
        }
    }

    displayBacktestResults(results) {
        const panel = document.getElementById('backtestResults');
        const stats = document.getElementById('backtestStats');

        panel.style.display = 'block';

        stats.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Trades</div>
                <div class="stat-value">${results.totalTrades}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Win Rate</div>
                <div class="stat-value ${results.winRate >= 50 ? 'positive' : 'negative'}">
                    ${results.winRate.toFixed(1)}%
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Profit Factor</div>
                <div class="stat-value ${results.profitFactor >= 1 ? 'positive' : 'negative'}">
                    ${results.profitFactor.toFixed(2)}
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Net Profit</div>
                <div class="stat-value ${results.netProfit >= 0 ? 'positive' : 'negative'}">
                    $${results.netProfit.toFixed(2)}
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Return</div>
                <div class="stat-value ${results.returnPercent >= 0 ? 'positive' : 'negative'}">
                    ${results.returnPercent.toFixed(2)}%
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Max Drawdown</div>
                <div class="stat-value negative">${results.maxDrawdown.toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Wins</div>
                <div class="stat-value positive">${results.wins}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Losses</div>
                <div class="stat-value negative">${results.losses}</div>
            </div>
        `;

        if (results.trades && results.trades.length > 0) {
            this.displayTradesTable(results.trades.slice(-20)); // Last 20 trades
        } else {
            document.getElementById('tradesTableContainer').innerHTML = "<p>No trades simulated.</p>";
        }
    }

    displayTradesTable(trades) {
        const container = document.getElementById('tradesTableContainer');

        const html = `
            <h4 style="margin: 20px 0 10px 0; color: #4a9eff;">Recent Trades (Last 20)</h4>
            <table class="trades-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>Outcome</th>
                        <th>P&L</th>
                        <th>Balance</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${trades.map(trade => `
                        <tr>
                            <td>${new Date(trade.time * 1000).toLocaleString()}</td>
                            <td class="trade-action ${trade.action}">${trade.action}</td>
                            <td>${trade.entry.toFixed(4)}</td>
                            <td>${trade.exit.toFixed(4)}</td>
                            <td class="trade-outcome ${trade.outcome}">${trade.outcome}</td>
                            <td class="${trade.pnl >= 0 ? 'trade-outcome WIN' : 'trade-outcome LOSS'}">
                                ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </td>
                            <td>${trade.balance.toFixed(2)}</td>
                            <td>${trade.confidence}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    async startLive() {
        if (this.isLive) return;

        const symbol = document.getElementById('symbolSelect').value;

        // 1. Load latest data first
        this.updateLiveButtons(true);
        const success = await this.loadData();

        if (!success) {
            this.isLive = false;
            this.updateLiveButtons(false);
            return;
        }

        this.isLive = true;
        this.showLoading('Starting live analysis...');

        try {
            // 2. Subscribe to candles for all timeframes
            // 30M (1800s)
            await this.derivAPI.subscribeLiveCandles(symbol, 1800, (data) => {
                this.handleLiveUpdate('tf30m', DerivAPI.formatOHLC(data.ohlc));
            });

            // 15M (900s)
            await this.derivAPI.subscribeLiveCandles(symbol, 900, (data) => {
                this.handleLiveUpdate('tf15m', DerivAPI.formatOHLC(data.ohlc));
            });

            // 1M (60s) for Entry
            await this.derivAPI.subscribeLiveCandles(symbol, 60, (data) => {
                this.handleLiveUpdate('tf1m', DerivAPI.formatOHLC(data.ohlc));
            });

            this.clearLoading();
            console.log('✅ Live trading started');

        } catch (error) {
            this.showError('Failed to start live: ' + error.message);
            this.stopLive();
        }
    }

    handleLiveUpdate(tf, candle) {
        if (!this.isLive || !candle) return;

        // Update strategy
        this.strategy.updateCandle(tf, candle);

        // Generate Signal
        const signal = this.strategy.generateSignal(this.getAnalysisOptions());
        this.currentSignal = signal;

        // Update Chart
        this.chartManager.updateCandle(tf, candle, signal.analysis[tf]);

        // Update UI
        this.updateSignalDisplay(signal);
        this.updateAnalysisPanel(signal.analysis);

        // Update specific status labels
        if (tf === 'tf30m') {
            document.getElementById('status30m').textContent =
                `${signal.analysis.tf30m.trend} | RSI: ${signal.analysis.tf30m.rsi.toFixed(1)}`;
        } else if (tf === 'tf1m') {
            document.getElementById('status1m').textContent =
                `RSI: ${signal.analysis.tf1m.rsi.toFixed(1)}`;
        }
    }

    stopLive() {
        this.isLive = false;
        this.updateLiveButtons(false);
        this.derivAPI.unsubscribe();
        console.log('⏸️ Live trading stopped');
    }

    updateLiveButtons(isLive) {
        const startBtn = document.getElementById('startLiveBtn');
        const stopBtn = document.getElementById('stopLiveBtn');
        const loadBtn = document.getElementById('loadDataBtn');
        const symbolSel = document.getElementById('symbolSelect');

        if (startBtn) startBtn.disabled = isLive;
        if (stopBtn) stopBtn.disabled = !isLive;
        if (loadBtn) loadBtn.disabled = isLive;
        if (symbolSel) symbolSel.disabled = isLive;
    }

    enableButtons() {
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('backtestBtn').disabled = false;
        document.getElementById('startLiveBtn').disabled = false;
    }

    playAlert() {
        // Simple beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    showLoading(message) {
        document.getElementById('errorContainer').innerHTML =
            `<div class="loading">${message}</div>`;
    }

    showError(message) {
        document.getElementById('errorContainer').innerHTML =
            `<div class="error">❌ ${message}</div>`;
    }

    clearLoading() {
        document.getElementById('errorContainer').innerHTML = '';
    }
}

// Start the app
const mtfApp = new MTFApp();