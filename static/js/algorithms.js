// Algorithm execution and visualization functionality for real map routing
class AlgorithmManager {
    constructor() {
        this.currentResults = null;
        this.noControls = false; // flag if controls are absent

        this.nodeHistory = { dijkstra: [], astar: [], bidirectional: [] }; // added bidirectional
        this.maxHistory = 3;

        this.metricHistories = {
            dijkstra: { nodes_explored: [], edges_relaxed: [], heuristic_calls: [], priority_queue_operations: [] },
            astar: { nodes_explored: [], edges_relaxed: [], heuristic_calls: [], priority_queue_operations: [] },
            bidirectional: { nodes_explored: [], edges_relaxed: [], heuristic_calls: [], priority_queue_operations: [] }
        };
        this.currentMetric = 'nodes_explored';

        this.colors = { dijkstra: '#007bff', bidirectional: '#8b5cf6', astar: '#dc3545' };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Find path button (may not exist in fullscreen minimal mode)
        const findBtn = document.getElementById('findPathBtn');
        if (findBtn) {
            findBtn.addEventListener('click', () => {
                this.findPath();
            });
        } else {
            this.noControls = true;
        }

        // Clear selection button
        const clearBtn = document.getElementById('clearSelectionBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (window.leafletMap) {
                    window.leafletMap.clearSelection();
                    window.leafletMap.updateUI();
                }
            });
        }

        // Complexity / performance buttons
        const complexityBtn = document.getElementById('showComplexityBtn');
        const performanceBtn = document.getElementById('showPerformanceBtn');
        if (complexityBtn) {
            complexityBtn.addEventListener('click', () => {
                this.showComplexityAnalysis();
            });
        }
        if (performanceBtn) {
            performanceBtn.addEventListener('click', () => {
                this.showPerformanceMetrics();
            });
        }

        // Metric selector for complexity chart
        const metricSelect = document.getElementById('complexityMetricSelect');
        if (metricSelect) {
            metricSelect.addEventListener('change', (e) => {
                this.currentMetric = e.target.value;
                this.updateMiniChartTitle();
                this.updateMiniComplexityChart();
            });
        }
    }

    updateMiniChartTitle() {
        const titleEl = document.getElementById('miniChartTitle');
        if (!titleEl) return;
        const map = {
            nodes_explored: 'Node Exploration (last 3 runs)',
            edges_relaxed: 'Edges Relaxed (Dijkstra)',
            heuristic_calls: 'Heuristic Calls (A*)',
            priority_queue_operations: 'Priority Queue Ops'
        };
        titleEl.textContent = map[this.currentMetric] || 'Metric';
    }

    async findPath() {
        if (!window.leafletMap || !window.leafletMap.isInitialized) {
            this.showError('Map is still loading. Please wait a moment and try again.');
            return;
        }

        if (!window.leafletMap.selectedStart || !window.leafletMap.selectedEnd) {
            this.showError('Please select start and end points by clicking on the map');
            return;
        }

        this.showLoading(true);

        try {
            const algoSelect = document.getElementById('algorithmSelect');
            const algorithm = algoSelect ? algoSelect.value : 'dijkstra';

            if (algorithm === 'compare') {
                await this.compareRoutes();
            } else {
                await this.findSingleRoute(algorithm);
            }

        } catch (error) {
            console.error('Error finding path:', error);
            this.showError('Failed to find route: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async findSingleRoute(algorithm) {
        const requestData = {
            start: window.leafletMap.selectedStart,
            end: window.leafletMap.selectedEnd,
            algorithm: algorithm,
            use_real_streets: true
        };

        const response = await fetch('/api/find-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        this.currentResults = result;

        this.recordMetricHistory(result);
        this.updateMiniComplexityChart();

        // Record node exploration history
        this.recordNodeHistory(result.algorithm, result.nodes_explored || (result.performance_analysis?.complexity_analysis?.nodes_explored));
        this.updateMiniComplexityChart();

        // Display the route on the map
        if (window.leafletMap) {
            if (result.algorithm === 'bidirectional' && window.leafletMap.displayBidirectionalRoute) {
                window.leafletMap.displayBidirectionalRoute(result);
            } else if (window.leafletMap.displayRoute) {
                window.leafletMap.displayRoute(result);
            }
        }

        // Update performance display with real data
        this.updatePerformanceDisplay(result);

        // Show success message with route details
        this.showSuccess(
            `Route found using ${result.algorithm}! ` +
            `Distance: ${result.total_distance} km, ` +
            `Duration: ${result.duration_minutes} minutes`
        );
    }

    async compareRoutes() {
        const requestData = {
            start: window.leafletMap.selectedStart,
            end: window.leafletMap.selectedEnd,
            algorithm: 'compare',
            use_real_streets: true
        };

        const response = await fetch('/api/find-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        this.currentResults = result;

        this.recordMetricHistory(result.dijkstra);
        this.recordMetricHistory(result.astar);
        this.updateMiniComplexityChart();

        // Record both algorithms' node counts
        this.recordNodeHistory('dijkstra', result.dijkstra.nodes_explored || (result.dijkstra.performance_analysis?.complexity_analysis?.nodes_explored));
        this.recordNodeHistory('astar', result.astar.nodes_explored || (result.astar.performance_analysis?.complexity_analysis?.nodes_explored));
        this.updateMiniComplexityChart();

        // Display comparison routes on the map
        if (window.leafletMap && window.leafletMap.displayComparison) {
            window.leafletMap.displayComparison(result.dijkstra, result.astar);
        }

        // Update performance display with comparison data
        this.updateComparisonPerformance(result);

        // Show comparison details
        const comparison = result.comparison;
        const dijkstra = result.dijkstra;
        const astar = result.astar;

        let message = `Route comparison completed!<br>`;
        message += `<strong>Dijkstra:</strong> ${dijkstra.total_distance}km, ${dijkstra.duration_minutes}min, ${dijkstra.nodes_explored} nodes<br>`;
        message += `<strong>A*:</strong> ${astar.total_distance}km, ${astar.duration_minutes}min, ${astar.nodes_explored} nodes<br>`;
        message += `<strong>Faster algorithm:</strong> ${comparison.faster_algorithm}<br>`;
        message += `<strong>Shorter path:</strong> ${comparison.shorter_path}`;

        this.showSuccess(message);
    }

    showLoading(show) {
        const btn = document.getElementById('findPathBtn');
        if (show) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Computing Route...';
            btn.disabled = true;
        } else {
            btn.innerHTML = 'Find Route';
            btn.disabled = !(window.leafletMap && window.leafletMap.hasValidSelection());
        }
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert-custom');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-custom mt-3`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert after the buttons
        const buttonsContainer = document.querySelector('.d-grid');
        if (buttonsContainer) {
            buttonsContainer.parentNode.insertBefore(alertDiv, buttonsContainer.nextSibling);
        }

        // Auto-remove success alerts after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    showComplexityAnalysis() {
        document.getElementById('showComplexityBtn').classList.add('active');
        document.getElementById('showPerformanceBtn').classList.remove('active');
        document.getElementById('complexityDisplay').style.display = 'block';
        document.getElementById('performanceDisplay').style.display = 'none';
        // Refresh chart now that it's visible
        this.updateMiniComplexityChart();
    }

    showPerformanceMetrics() {
        // Toggle active state
        document.getElementById('showPerformanceBtn').classList.add('active');
        document.getElementById('showComplexityBtn').classList.remove('active');

        // Show performance display, hide complexity
        document.getElementById('performanceDisplay').style.display = 'block';
        document.getElementById('complexityDisplay').style.display = 'none';
    }

    recordNodeHistory(algo, value) {
        if (!value || !this.nodeHistory[algo]) return;
        this.nodeHistory[algo].push(value);
        if (this.nodeHistory[algo].length > this.maxHistory) {
            this.nodeHistory[algo].shift();
        }
    }

    recordMetricHistory(result) {
        if (!result || !result.algorithm) return;
        const algo = result.algorithm === 'astar' ? 'astar' : (result.algorithm === 'bidirectional' ? 'bidirectional' : 'dijkstra');
        const perf = result.performance_analysis?.complexity_analysis || {};
        const detailed = result.performance_analysis?.detailed_metrics || {};
        const snapshot = {
            nodes_explored: perf.nodes_explored ?? result.nodes_explored ?? 0,
            edges_relaxed: detailed.edges_relaxed ?? perf.edges_relaxed ?? 0,
            heuristic_calls: detailed.heuristic_calls ?? perf.heuristic_calls ?? 0,
            priority_queue_operations: detailed.priority_queue_operations ?? perf.priority_queue_operations ?? 0
        };
        Object.entries(snapshot).forEach(([metric, value]) => {
            const arr = this.metricHistories[algo][metric];
            arr.push(value || 0);
            if (arr.length > this.maxHistory) arr.shift();
        });
    }

    updateMiniComplexityChart() { this.updateVisualCharts(); }

    updateVisualCharts() {
        const metric = this.currentMetric;
        const trendCanvas = document.getElementById('trendChart');
        if (!trendCanvas) return;
        const ctx = trendCanvas.getContext('2d');
        const djVals = [...this.metricHistories.dijkstra[metric]];
        const biVals = [...this.metricHistories.bidirectional[metric]];
        const asVals = [...this.metricHistories.astar[metric]];
        if (djVals.length === 0 && asVals.length === 0 && biVals.length === 0) {
            ctx.clearRect(0,0,trendCanvas.width, trendCanvas.height);
            return;
        }
        const maxAll = Math.max(1, ...djVals, ...asVals, ...biVals);
        ctx.clearRect(0,0,trendCanvas.width, trendCanvas.height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(30,5); ctx.lineTo(30,80); ctx.lineTo(trendCanvas.width-5,80); ctx.stroke();
        const plotSeries = (vals, color) => {
            if (!vals.length) return;
            const left = 30; const bottom = 80; const top = 10; const usableH = bottom - top; const w = trendCanvas.width - left - 10;
            const stepX = vals.length > 1 ? (w / (vals.length - 1)) : 0;
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
            vals.forEach((v,i)=>{ const norm = v / maxAll; const y = bottom - norm * usableH; const x = left + i * stepX; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
            ctx.stroke();
            vals.forEach((v,i)=>{ const norm = v / maxAll; const y = bottom - norm * usableH; const x = left + i * stepX; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill(); });
        };
        plotSeries(djVals, this.colors.dijkstra);
        plotSeries(biVals, this.colors.bidirectional);
        plotSeries(asVals, this.colors.astar);
        ctx.fillStyle = '#64748b'; ctx.font = '10px Segoe UI';
        ctx.fillText(maxAll.toString(), 2, 12);
        ctx.fillText(Math.round(maxAll/2).toString(), 2, 42);
        ctx.fillText('0', 10, 80);
        this.drawGauge('gaugeDijkstra', djVals[djVals.length-1], maxAll, this.colors.dijkstra, metric === 'heuristic_calls');
        this.drawGauge('gaugeBidirectional', biVals[biVals.length-1], maxAll, this.colors.bidirectional, metric === 'heuristic_calls');
        this.drawGauge('gaugeAstar', asVals[asVals.length-1], maxAll, this.colors.astar, metric === 'edges_relaxed');
    }

    drawGauge(id, value, maxAll, color, dim) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width, canvas.height);
        if (value === undefined) { ctx.globalAlpha=0.2; ctx.fillStyle='#94a3b8'; ctx.fillText('No data', 30, canvas.height/2); ctx.globalAlpha=1; return; }
        const radius = 50; const cx = canvas.width/2; const cy = canvas.height/2 + 10;
        const start = Math.PI * 0.75; const end = Math.PI * 2.25; // 270 deg arc
        // Track
        ctx.lineWidth = 10; ctx.strokeStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.stroke();
        // Value
        const frac = Math.min(1, value / maxAll);
        ctx.strokeStyle = color; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + (end-start)*frac); ctx.stroke();
        // Value text
        ctx.fillStyle = dim ? 'rgba(100,116,139,0.4)' : '#334155'; ctx.font='12px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(value.toString(), cx, cy-5);
        ctx.font='10px Segoe UI'; ctx.fillStyle='#64748b'; ctx.fillText(this.metricLabelShort(this.currentMetric), cx, cy+18);
        if (dim) { ctx.fillStyle='rgba(100,116,139,0.5)'; ctx.fillText('n/a', cx, cy+32); }
    }

    metricLabelShort(m){
        switch(m){
            case 'nodes_explored': return 'Nodes';
            case 'edges_relaxed': return 'Edges';
            case 'heuristic_calls': return 'Heuristic';
            case 'priority_queue_operations': return 'PQ Ops';
            default: return m;
        }
    }

    // Added back performance display update methods (previously removed)
    updatePerformanceDisplay(result) {
        if (!result) return;
        const analysis = result.performance_analysis?.complexity_analysis;
        if (!analysis) return; // nothing to show yet
        const algEl = document.getElementById('lastRouteAlgorithm');
        const timeEl = document.getElementById('lastExecutionTime');
        const nodesEl = document.getElementById('lastNodesExplored');
        const effEl = document.getElementById('lastEfficiency');
        if (algEl) algEl.textContent = result.algorithm || '-';
        const execMs = analysis.execution_time_ms || result.execution_time;
        if (timeEl) timeEl.textContent = (typeof execMs === 'number' ? execMs.toFixed(2) : execMs) + 'ms';
        if (nodesEl) nodesEl.textContent = analysis.nodes_explored ?? result.nodes_explored ?? '-';
        if (effEl) effEl.textContent = (analysis.efficiency_ratio?.toFixed ? analysis.efficiency_ratio.toFixed(1) : analysis.efficiency_ratio) + '%';
        // Basic insights (reuse existing container if present)
        const insightsDiv = document.getElementById('performanceInsights');
        if (insightsDiv && analysis.performance_insights) {
            insightsDiv.innerHTML = analysis.performance_insights.slice(0,2).map(i=>`<div class="insight-item">${i}</div>`).join('');
        }
    }

    updateComparisonPerformance(result) {
        if (!result || !result.dijkstra || !result.astar) return;
        const dijkstra = result.dijkstra;
        const astar = result.astar;
        const comparison = result.comparison || {};
        const algEl = document.getElementById('lastRouteAlgorithm');
        const timeEl = document.getElementById('lastExecutionTime');
        const nodesEl = document.getElementById('lastNodesExplored');
        const effEl = document.getElementById('lastEfficiency');
        if (algEl) algEl.textContent = 'Comparison';
        if (timeEl) timeEl.textContent = `D:${dijkstra.execution_time}ms / A*:${astar.execution_time}ms`;
        if (nodesEl) nodesEl.textContent = `${dijkstra.nodes_explored} / ${astar.nodes_explored}`;
        const dEff = dijkstra.performance_analysis?.complexity_analysis?.efficiency_ratio || 0;
        const aEff = astar.performance_analysis?.complexity_analysis?.efficiency_ratio || 0;
        if (effEl) effEl.textContent = `${dEff.toFixed(1)}% / ${aEff.toFixed(1)}%`;
        const insightsDiv = document.getElementById('performanceInsights');
        if (insightsDiv) {
            insightsDiv.innerHTML = `
                <div class="insight-item"><strong>Comparison Results</strong></div>
                <div class="insight-item">Faster: ${comparison.faster_algorithm || '-'}</div>
                <div class="insight-item">Shorter: ${comparison.shorter_path || '-'}</div>
                <div class="insight-item">Time Δ: ${(comparison.time_difference||0).toFixed ? (comparison.time_difference).toFixed(2) : comparison.time_difference}ms</div>
            `;
        }
    }
}

// Initialize algorithm manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.algorithmManager = new AlgorithmManager();

    // Only trigger default view if buttons exist
    const complexityBtn = document.getElementById('showComplexityBtn');
    if (complexityBtn) {
        complexityBtn.click();
    }
});
