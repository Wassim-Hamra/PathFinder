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

        // Enable export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
        }
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

        // Enable export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
        }
    }

    exportRoute() {
        if (!this.currentResults) {
            this.showError('No route to export');
            return;
        }

        const dataStr = JSON.stringify(this.currentResults, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `route_${new Date().getTime()}.json`;
        link.click();

        this.showSuccess('Route exported successfully!');
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
}

// Initialize algorithm manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Algorithm Manager...');

    // Wait for map to be ready
    setTimeout(() => {
        window.algorithmManager = new AlgorithmManager();
        console.log('Algorithm Manager initialized');
    }, 200);
});
