/**
 * Interactive Leaflet Map Component for Real Street Route Visualization
 * Uses OSRM API for reliable street routing
 */

class LeafletMapComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.startMarker = null;
        this.endMarker = null;
        this.routeLayer = null;
        this.selectedStart = null;
        this.selectedEnd = null;
        this.isInitialized = false;

        this.options = {
            defaultZoom: 13,
            center: [40.7128, -74.0060], // NYC default
            ...options
        };

        this.colors = {
            route: '#3b82f6',
            start: '#22c55e',
            end: '#dc2626'
        };
    }

    init() {
        this.createMap();
        this.setupMapClickHandler();
        this.isInitialized = true;
        console.log('Map initialized successfully');
        return this;
    }

    createMap() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Map container ${this.containerId} not found`);
            return;
        }

        this.map = L.map(this.containerId, {
            zoomControl: true,
            attributionControl: true
        }).setView(this.options.center, this.options.defaultZoom);

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        console.log('Map created successfully');
    }

    setupMapClickHandler() {
        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            console.log(`Map clicked at: ${lat}, ${lng}`);

            if (!this.selectedStart) {
                // Clear any existing routes when starting new selection
                this.clearRoute();
                this.setStartPoint([lat, lng]);
            } else if (!this.selectedEnd) {
                this.setEndPoint([lat, lng]);
            } else {
                // If both points are selected, reset and start over
                this.clearSelection();
                this.setStartPoint([lat, lng]);
            }

            this.updateUI();
        });
    }

    setStartPoint(coords) {
        this.selectedStart = coords;

        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        this.startMarker = L.marker(coords, {
            icon: L.divIcon({
                className: 'custom-marker start-marker',
                html: `
                    <div class="marker-pin start-pin">
                        <div class="marker-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </div>
                        <div class="marker-pulse start-pulse"></div>
                    </div>
                `,
                iconSize: [40, 50],
                iconAnchor: [20, 50],
                popupAnchor: [0, -50]
            })
        }).addTo(this.map);

        // Add popup
        this.startMarker.bindPopup(
            `<div class="marker-popup start-popup">
                <strong>🚀 Start Point</strong><br>
                <small>${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</small>
            </div>`
        );

        console.log('Start point set:', coords);
    }

    setEndPoint(coords) {
        this.selectedEnd = coords;

        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }

        this.endMarker = L.marker(coords, {
            icon: L.divIcon({
                className: 'custom-marker end-marker',
                html: `
                    <div class="marker-pin end-pin">
                        <div class="marker-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                        </div>
                        <div class="marker-pulse end-pulse"></div>
                    </div>
                `,
                iconSize: [40, 50],
                iconAnchor: [20, 50],
                popupAnchor: [0, -50]
            })
        }).addTo(this.map);

        // Add popup
        this.endMarker.bindPopup(
            `<div class="marker-popup end-popup">
                <strong>🎯 Destination</strong><br>
                <small>${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</small>
            </div>`
        );

        console.log('End point set:', coords);
    }

    clearSelection() {
        this.selectedStart = null;
        this.selectedEnd = null;

        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
            this.startMarker = null;
        }

        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
            this.endMarker = null;
        }

        this.clearRoute();
        console.log('Selection cleared');
    }

    clearRoute() {
        // Clear main route layer
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }

        // Clear any comparison route layers
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && layer !== this.routeLayer) {
                // Remove any polyline that's not the main route (comparison routes)
                this.map.removeLayer(layer);
            }
        });

        console.log('All routes cleared from map');
    }

    displayRoute(routeData) {
        console.log('Displaying route:', routeData);

        this.clearRoute();

        if (!routeData.coordinates || routeData.coordinates.length === 0) {
            console.error('No route coordinates provided');
            return;
        }

        // Create animated route line
        this.routeLayer = L.polyline([], {
            color: this.colors.route,
            weight: 6,
            opacity: 0,
            smoothFactor: 1,
            className: 'animated-route'
        }).addTo(this.map);

        // Animate the route drawing
        this.animateRoute(routeData.coordinates, this.routeLayer);

        // Fit map to show the entire route after animation starts
        setTimeout(() => {
            const group = new L.featureGroup([this.routeLayer]);
            if (this.startMarker) group.addLayer(this.startMarker);
            if (this.endMarker) group.addLayer(this.endMarker);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }, 100);

        console.log('Route displayed successfully');
    }

    animateRoute(coordinates, polyline) {
        let currentIndex = 0;
        const animationSpeed = 20; // milliseconds between points
        const coordinatesPerFrame = 2; // Add multiple points per frame for smoother animation

        // Set initial opacity
        polyline.setStyle({ opacity: 0.8 });

        const animate = () => {
            if (currentIndex < coordinates.length) {
                // Add next batch of coordinates
                const endIndex = Math.min(currentIndex + coordinatesPerFrame, coordinates.length);
                const newCoords = coordinates.slice(0, endIndex);

                polyline.setLatLngs(newCoords);

                currentIndex = endIndex;
                setTimeout(animate, animationSpeed);
            } else {
                // Animation complete - add final styling
                polyline.setStyle({
                    opacity: 0.9,
                    weight: 6,
                    className: 'route-complete'
                });

                // Add route completion effect
                this.addRouteCompletionEffect(polyline);
            }
        };

        animate();
    }

    addRouteCompletionEffect(polyline) {
        // Add a temporary glow effect when route is complete
        const originalStyle = {
            color: polyline.options.color,
            weight: polyline.options.weight,
            opacity: polyline.options.opacity
        };

        // Glow effect
        polyline.setStyle({
            color: '#ffdd00',
            weight: 8,
            opacity: 1
        });

        // Return to original style after glow
        setTimeout(() => {
            polyline.setStyle(originalStyle);
        }, 800);
    }

    displayComparison(dijkstraResult, astarResult) {
        console.log('Displaying route comparison');

        this.clearRoute();

        // Display Dijkstra route first
        if (dijkstraResult.coordinates && dijkstraResult.coordinates.length > 0) {
            const dijkstraLayer = L.polyline([], {
                color: '#3b82f6',
                weight: 5,
                opacity: 0,
                dashArray: '10, 5',
                className: 'dijkstra-route'
            }).addTo(this.map);
            dijkstraLayer.bindPopup(`
                <div class="route-popup dijkstra-popup">
                    <strong>🔵 Dijkstra Algorithm</strong><br>
                    Distance: ${dijkstraResult.total_distance}km<br>
                    Duration: ${dijkstraResult.duration_minutes}min<br>
                    Nodes Explored: ${dijkstraResult.nodes_explored}
                </div>
            `);

            // Animate Dijkstra route
            this.animateComparisonRoute(dijkstraResult.coordinates, dijkstraLayer, 0);
        }

        // Display A* route with delay
        if (astarResult.coordinates && astarResult.coordinates.length > 0) {
            setTimeout(() => {
                const astarLayer = L.polyline([], {
                    color: '#dc2626',
                    weight: 5,
                    opacity: 0,
                    dashArray: '5, 10',
                    className: 'astar-route'
                }).addTo(this.map);
                astarLayer.bindPopup(`
                    <div class="route-popup astar-popup">
                        <strong>🔴 A* Algorithm</strong><br>
                        Distance: ${astarResult.total_distance}km<br>
                        Duration: ${astarResult.duration_minutes}min<br>
                        Nodes Explored: ${astarResult.nodes_explored}
                    </div>
                `);

                // Animate A* route
                this.animateComparisonRoute(astarResult.coordinates, astarLayer, 0);
            }, 1000); // Delay A* animation by 1 second
        }

        console.log('Comparison routes displayed');
    }

    animateComparisonRoute(coordinates, polyline, delay = 0) {
        setTimeout(() => {
            let currentIndex = 0;
            const animationSpeed = 15; // Faster for comparison
            const coordinatesPerFrame = 3;

            polyline.setStyle({ opacity: 0.8 });

            const animate = () => {
                if (currentIndex < coordinates.length) {
                    const endIndex = Math.min(currentIndex + coordinatesPerFrame, coordinates.length);
                    const newCoords = coordinates.slice(0, endIndex);

                    polyline.setLatLngs(newCoords);
                    currentIndex = endIndex;
                    setTimeout(animate, animationSpeed);
                } else {
                    // Animation complete
                    polyline.setStyle({ opacity: 0.9 });
                }
            };

            animate();
        }, delay);
    }

    updateUI() {
        // Update status display
        const statusDiv = document.getElementById('selectionStatus');
        if (statusDiv) {
            let statusText = '';
            if (this.selectedStart) {
                statusText += `<span class="text-success">✓ Start: ${this.selectedStart[0].toFixed(4)}, ${this.selectedStart[1].toFixed(4)}</span><br>`;
            } else {
                statusText += '<span class="text-muted">○ Click map to set start point</span><br>';
            }

            if (this.selectedEnd) {
                statusText += `<span class="text-danger">✓ End: ${this.selectedEnd[0].toFixed(4)}, ${this.selectedEnd[1].toFixed(4)}</span>`;
            } else {
                statusText += '<span class="text-muted">○ Click map to set end point</span>';
            }

            statusDiv.innerHTML = statusText;
        }

        // Enable/disable find route button
        const findBtn = document.getElementById('findPathBtn');
        if (findBtn) {
            findBtn.disabled = !(this.selectedStart && this.selectedEnd);
        }

        // Enable/disable export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.disabled = !this.routeLayer;
        }
    }

    getSelectedPoints() {
        return {
            start: this.selectedStart,
            end: this.selectedEnd
        };
    }

    hasValidSelection() {
        return this.selectedStart && this.selectedEnd;
    }
}

// Global map instance
let leafletMap;

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing map...');

    // Wait a bit to ensure all dependencies are loaded
    setTimeout(() => {
        leafletMap = new LeafletMapComponent('map', {
            center: [40.7128, -74.0060], // NYC
            defaultZoom: 13
        });

        leafletMap.init();

        // Make it globally accessible
        window.leafletMap = leafletMap;

        console.log('Map setup complete');
    }, 100);
});
