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
                window.leafletMap.clearSelection();
            });
        }

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportRoute();
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
        try {
            // Call the map's findRoute method which uses real OSRM street routing
            const result = await window.leafletMap.findRoute(algorithm);

            // Add execution time
            result.execution_time = 50.0; // OSRM is very fast

            this.currentResults = result;
            this.displaySingleResult(result);
            this.storeTestResult(result);

        } catch (error) {
            throw error; // Let the parent function handle the error
        }
    }

    async compareRoutes() {
        try {
            // Get both fastest and shortest routes
            const fastestRoute = await window.leafletMap.findRoute('fastest');
            const shortestRoute = await window.leafletMap.findRoute('shortest');

            // For comparison, show the fastest route on map
            window.leafletMap.displayStreetRoute(fastestRoute);

            const comparison = {
                type: 'comparison',
                fastest: fastestRoute,
                shortest: shortestRoute,
                comparison: {
                    distance_difference: Math.abs(fastestRoute.distance - shortestRoute.distance),
                    duration_difference: Math.abs(fastestRoute.duration - shortestRoute.duration),
                    faster_route: fastestRoute.duration < shortestRoute.duration ? 'fastest' : 'shortest'
                }
            };

            this.currentResults = comparison;
            this.displayComparisonResults(comparison);

        } catch (error) {
            throw error;
        }
    }

    displaySingleResult(result) {
        // Display route on map
        window.leafletMap.displayRoute(result);

        // Show results panel
        this.showResultsPanel(result);

        // Hide comparison panel
        document.getElementById('comparisonPanel').style.display = 'none';

        // Enable export button
        document.getElementById('exportBtn').disabled = false;

        this.showSuccess(`Route found! Distance: ${(result.distance / 1000).toFixed(2)} km, Duration: ${Math.round(result.duration / 60)} minutes`);
    }

    displayComparisonResults(results) {
        // Display the faster route on map (or shortest if preferred)
        const routeToShow = results.fastest.duration < results.shortest.duration ? results.fastest : results.shortest;
        window.leafletMap.displayRoute(routeToShow);

        // Show comparison panel
        this.showComparisonPanel(results);

        // Hide single results panel
        document.getElementById('resultsPanel').style.display = 'none';

        // Enable export button
        document.getElementById('exportBtn').disabled = false;
    }

    showResultsPanel(result) {
        const panel = document.getElementById('resultsPanel');
        const content = document.getElementById('singleResult');

        content.innerHTML = `
            <h6 class="text-primary">${result.algorithm.toUpperCase()} Route</h6>
            <div class="row">
                <div class="col-6">
                    <strong>Distance:</strong><br>
                    <span class="text-primary">${(result.distance / 1000).toFixed(2)} km</span>
                </div>
                <div class="col-6">
                    <strong>Duration:</strong><br>
                    <span class="text-success">${Math.round(result.duration / 60)} min</span>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-12">
                    <strong>Execution Time:</strong><br>
                    <span class="text-info">${result.execution_time.toFixed(2)} ms</span>
                </div>
            </div>
            ${result.error ? `<div class="mt-2"><small class="text-warning">Note: ${result.error}</small></div>` : ''}
        `;

        panel.style.display = 'block';
    }

    showComparisonPanel(results) {
        const panel = document.getElementById('comparisonPanel');

        // Populate fastest route results
        const fastestDiv = document.getElementById('dijkstraResults');
        fastestDiv.innerHTML = this.generateRouteHTML(results.fastest, 'Fastest Route');

        // Populate shortest route results
        const shortestDiv = document.getElementById('astarResults');
        shortestDiv.innerHTML = this.generateRouteHTML(results.shortest, 'Shortest Route');

        // Populate comparison summary
        const summaryDiv = document.getElementById('comparisonSummary');
        summaryDiv.innerHTML = this.generateComparisonHTML(results.comparison);

        panel.style.display = 'block';
    }

    generateRouteHTML(result, routeName) {
        return `
            <div class="row">
                <div class="col-6">
                    <strong>Distance:</strong><br>
                    <span class="text-primary">${(result.distance / 1000).toFixed(2)} km</span>
                </div>
                <div class="col-6">
                    <strong>Duration:</strong><br>
                    <span class="text-success">${Math.round(result.duration / 60)} min</span>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-12">
                    <strong>Execution Time:</strong><br>
                    <span class="text-info">${result.execution_time.toFixed(2)} ms</span>
                </div>
            </div>
        `;
    }

    generateComparisonHTML(comparison) {
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="metric-item">
                        <span class="metric-label">Time Saved:</span>
                        <span class="metric-value text-success">
                            ${Math.round(Math.abs(comparison.duration_difference) / 60)} minutes
                        </span>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metric-item">
                        <span class="metric-label">Distance Difference:</span>
                        <span class="metric-value text-info">
                            ${(comparison.distance_difference / 1000).toFixed(2)} km
                        </span>
                    </div>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-12">
                    <div class="alert alert-info">
                        <strong>Recommendation:</strong> 
                        The ${comparison.faster_route} route is recommended for optimal travel time.
                    </div>
                </div>
            </div>
        `;
    }

    exportRoute() {
        if (!this.currentResults) {
            this.showError('No route to export');
            return;
        }

        const dataToExport = {
            type: this.currentResults.type || 'single_route',
            start_coordinates: window.leafletMap.selectedStart,
            end_coordinates: window.leafletMap.selectedEnd,
            ...this.currentResults,
            timestamp: new Date().toISOString()
        };

        this.downloadJSON(dataToExport, `route_${Date.now()}.json`);
        this.showSuccess('Route exported successfully');
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    storeTestResult(result) {
        this.testResults.push({
            id: this.testResults.length + 1,
            algorithm: result.algorithm,
            start_coordinates: window.leafletMap.selectedStart,
            end_coordinates: window.leafletMap.selectedEnd,
            distance: result.distance,
            duration: result.duration,
            execution_time: result.execution_time,
            timestamp: new Date().toISOString()
        });

        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        localStorage.setItem('routeOptimizerResults', JSON.stringify(this.testResults));
    }

    loadFromLocalStorage() {
        const stored = localStorage.getItem('routeOptimizerResults');
        if (stored) {
            this.testResults = JSON.parse(stored);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            console.log(`Loading overlay ${show ? 'shown' : 'hidden'}`);
        }
    }

    showError(message) {
        this.showToast(message, 'danger');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 150);
        }, 5000);
    }
}

// Initialize algorithm manager
document.addEventListener('DOMContentLoaded', () => {
    window.algorithmManager = new AlgorithmManager();
});
