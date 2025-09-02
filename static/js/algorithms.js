// Algorithm execution and visualization functionality for real map routing
class AlgorithmManager {
    constructor() {
        this.isRunning = false;
        this.currentResults = null;
        this.testResults = [];

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Find path button
        document.getElementById('findPathBtn').addEventListener('click', () => {
            this.findPath();
        });

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

        // Complexity analysis toggle buttons
        document.getElementById('showComplexityBtn').addEventListener('click', () => {
            this.showComplexityAnalysis();
        });

        document.getElementById('showPerformanceBtn').addEventListener('click', () => {
            this.showPerformanceMetrics();
        });
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
            const algorithm = document.getElementById('algorithmSelect').value;

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

        console.log('Finding route with:', requestData);

        const response = await fetch('/api/find-route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Route result:', result);

        if (result.error) {
            throw new Error(result.error);
        }

        this.currentResults = result;

        // Display the route on the map
        if (window.leafletMap && window.leafletMap.displayRoute) {
            window.leafletMap.displayRoute(result);
        }

        // Update performance display with real data
        this.updatePerformanceDisplay(result);

        // Show success message with route details
        this.showRouteDetails(result);
    }

    async compareRoutes() {
        const requestData = {
            start: window.leafletMap.selectedStart,
            end: window.leafletMap.selectedEnd,
            algorithm: 'compare',
            use_real_streets: true
        };

        console.log('Comparing routes with:', requestData);

        const response = await fetch('/api/find-route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Comparison result:', result);

        if (result.error) {
            throw new Error(result.error);
        }

        this.currentResults = result;

        // Display comparison routes on the map
        if (window.leafletMap && window.leafletMap.displayComparison) {
            window.leafletMap.displayComparison(result.dijkstra, result.astar);
        }

        // Update performance display with comparison data
        this.updateComparisonPerformance(result);

        // Show comparison details
        this.showComparisonDetails(result);
    }

    showRouteDetails(result) {
        const algorithm = result.algorithm.charAt(0).toUpperCase() + result.algorithm.slice(1);

        this.showSuccess(
            `Route found using ${algorithm}! ` +
            `Distance: ${result.total_distance} km, ` +
            `Duration: ${result.duration_minutes} minutes`
        );
    }

    showComparisonDetails(result) {
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
        // Toggle active state
        document.getElementById('showComplexityBtn').classList.add('active');
        document.getElementById('showPerformanceBtn').classList.remove('active');

        // Show complexity display, hide performance
        document.getElementById('complexityDisplay').style.display = 'block';
        document.getElementById('performanceDisplay').style.display = 'none';

        // Animate the mini chart bars
        this.animateMiniChart();
    }

    showPerformanceMetrics() {
        // Toggle active state
        document.getElementById('showPerformanceBtn').classList.add('active');
        document.getElementById('showComplexityBtn').classList.remove('active');

        // Show performance display, hide complexity
        document.getElementById('performanceDisplay').style.display = 'block';
        document.getElementById('complexityDisplay').style.display = 'none';
    }

    animateMiniChart() {
        // Add animation classes to mini bars
        const miniBars = document.querySelectorAll('.mini-bar');
        miniBars.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.transition = 'height 0.8s ease-out';
            }, index * 100);
        });
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
    }

    updateComplexityVisualization(result) {
        // Update the mini chart with actual performance data
        if (result.performance_analysis) {
            const analysis = result.performance_analysis.complexity_analysis;

            // Update algorithm-specific bars based on actual performance
            const algorithm = result.algorithm.toLowerCase();
            const efficiencyRatio = analysis.efficiency_ratio || 0;

            // Animate bars based on efficiency (lower is better for exploration)
            const barHeight = Math.max(10, 100 - efficiencyRatio); // Invert for visualization

            if (algorithm === 'dijkstra') {
                document.querySelectorAll('.dijkstra-mini').forEach(bar => {
                    bar.style.height = `${barHeight}%`;
                });
            } else if (algorithm === 'astar') {
                document.querySelectorAll('.astar-mini').forEach(bar => {
                    bar.style.height = `${barHeight}%`;
                });
            }
        }
    }
}

// Initialize algorithm manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.algorithmManager = new AlgorithmManager();

    // Set default display to complexity analysis
    document.getElementById('showComplexityBtn').click();
});
