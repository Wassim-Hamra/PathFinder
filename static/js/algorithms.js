// Algorithm execution and visualization functionality for real map routing
class AlgorithmManager {
    constructor() {
        this.currentResults = null;
        this.noControls = false; // flag if controls are absent

        this.nodeHistory = { dijkstra: [], astar: [] }; // store last 3 node counts per algorithm
        this.maxHistory = 3;

        this.metricHistories = {
            dijkstra: { nodes_explored: [], edges_relaxed: [], heuristic_calls: [], priority_queue_operations: [] },
            astar: { nodes_explored: [], edges_relaxed: [], heuristic_calls: [], priority_queue_operations: [] }
        };
        this.currentMetric = 'nodes_explored';

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
        if (window.leafletMap && window.leafletMap.displayRoute) {
            window.leafletMap.displayRoute(result);
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
        const algo = result.algorithm === 'astar' ? 'astar' : 'dijkstra';
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

    updateMiniComplexityChart() {
        const groups = document.querySelectorAll('.mini-bar-group');
        if (!groups.length) return;
        const metric = this.currentMetric;
        const djVals = [...this.metricHistories.dijkstra[metric]];
        const asVals = [...this.metricHistories.astar[metric]];
        // If both empty, nothing to show
        if (djVals.length === 0 && asVals.length === 0) return;

        const djRev = djVals.slice(-this.maxHistory).reverse();
        const asRev = asVals.slice(-this.maxHistory).reverse();
        const all = djRev.concat(asRev).filter(v => typeof v === 'number');
        if (!all.length) return;
        const maxAll = Math.max(...all);
        const minAll = Math.min(...all);
        const range = maxAll - minAll;
        const identical = range === 0;
        const fallbackHeights = [70, 55, 40];
        const computeHeight = (val, idx) => {
            if (val === undefined) return 0;
            if (identical) return fallbackHeights[idx] || 35;
            const norm = (val - minAll) / (range || 1);
            const curved = Math.sqrt(norm);
            return 25 + curved * 75;
        };
        groups.forEach((group, idx) => {
            const dBar = group.querySelector('.mini-bar.dijkstra-mini');
            const aBar = group.querySelector('.mini-bar.astar-mini');
            const dVal = djRev[idx];
            const aVal = asRev[idx];
            const dH = computeHeight(dVal, idx);
            const aH = computeHeight(aVal, idx);
            if (dBar) {
                dBar.style.height = dVal !== undefined ? dH.toFixed(1) + '%' : '0%';
                dBar.title = dVal !== undefined ? `Dijkstra ${metric}: ${dVal}` : 'No data';
                dBar.style.opacity = (metric === 'heuristic_calls') ? 0.25 : 1; // dim metric not relevant
            }
            if (aBar) {
                aBar.style.height = aVal !== undefined ? aH.toFixed(1) + '%' : '0%';
                aBar.title = aVal !== undefined ? `A* ${metric}: ${aVal}` : 'No data';
                aBar.style.opacity = (metric === 'edges_relaxed') ? 0.25 : 1;
            }
            const label = group.querySelector('.bar-label');
            if (label) {
                if (dVal !== undefined || aVal !== undefined) label.textContent = idx === 0 ? 'Latest' : `Run -${idx}`; else label.textContent = '—';
            }
        });
    }

    updateComparisonPerformance(result) {
        // Update performance metrics for comparison
        const dijkstra = result.dijkstra;
        const astar = result.astar;
        const comparison = result.comparison;

        // Show comparison in performance display
        const insightsDiv = document.getElementById('performanceInsights');
        insightsDiv.innerHTML = `
            <div class="insight-item"><strong>Comparison Results:</strong></div>
            <div class="insight-item">Faster: ${comparison.faster_algorithm}</div>
            <div class="insight-item">Shorter: ${comparison.shorter_path}</div>
            <div class="insight-item">Time diff: ${comparison.time_difference.toFixed(2)}ms</div>
        `;

        // Update metrics with comparison data
        document.getElementById('lastRouteAlgorithm').textContent = 'Comparison';
        document.getElementById('lastExecutionTime').textContent = `D:${dijkstra.execution_time.toFixed(1)}ms / A*:${astar.execution_time.toFixed(1)}ms`;
        document.getElementById('lastNodesExplored').textContent = `${dijkstra.nodes_explored} / ${astar.nodes_explored}`;

        // Calculate efficiency ratios
        const dijkstraEfficiency = dijkstra.performance_analysis?.complexity_analysis?.efficiency_ratio || 0;
        const astarEfficiency = astar.performance_analysis?.complexity_analysis?.efficiency_ratio || 0;
        document.getElementById('lastEfficiency').textContent = `${dijkstraEfficiency.toFixed(1)}% / ${astarEfficiency.toFixed(1)}%`;

        // After updating metrics also update chart (already handled after recording, keep in case order changes)
        this.updateMiniComplexityChart();
    }

    updatePerformanceDisplay(result) {
        // Update performance metrics from route result
        if (result.performance_analysis) {
            const analysis = result.performance_analysis.complexity_analysis;

            document.getElementById('lastRouteAlgorithm').textContent = result.algorithm;
            document.getElementById('lastExecutionTime').textContent = `${analysis.execution_time_ms.toFixed(2)}ms`;
            document.getElementById('lastNodesExplored').textContent = analysis.nodes_explored;
            document.getElementById('lastEfficiency').textContent = `${analysis.efficiency_ratio.toFixed(1)}%`;

            // Update insights
            const insights = analysis.performance_insights;
            const insightsDiv = document.getElementById('performanceInsights');

            if (insights && insights.length > 0) {
                let insightsHtml = '';
                insights.slice(0, 2).forEach(insight => {
                    insightsHtml += `<div class="insight-item">${insight}</div>`;
                });
                insightsDiv.innerHTML = insightsHtml;
            }
        }

        // Keep chart fresh after single result updates
        this.updateMiniComplexityChart();
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
