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
        this.isZooming = false;
        this.currentAnimation = null;

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
            // Ignore clicks during zoom operations
            if (this.isZooming) {
                return;
            }

            const { lat, lng } = e.latlng;
            console.log(`Map clicked at: ${lat}, ${lng}`);

            // Only process clicks if no route is currently displayed
            // This prevents accidental clearing during zoom operations
            if (!this.routeLayer) {
                if (!this.selectedStart) {
                    this.setStartPoint([lat, lng]);
                } else if (!this.selectedEnd) {
                    this.setEndPoint([lat, lng]);
                } else {
                    // If both points are selected but no route, allow reset
                    this.clearSelection();
                    this.setStartPoint([lat, lng]);
                }
            } else {
                // If route exists and user deliberately clicks, allow clearing
                // Only clear if click is far from existing markers
                const startDistance = this.selectedStart ?
                    this.map.distance(e.latlng, L.latLng(this.selectedStart[0], this.selectedStart[1])) : Infinity;
                const endDistance = this.selectedEnd ?
                    this.map.distance(e.latlng, L.latLng(this.selectedEnd[0], this.selectedEnd[1])) : Infinity;

                // Only reset if click is more than 100 meters from existing markers
                if (startDistance > 100 && endDistance > 100) {
                    // Clear and set new start point without confirmation
                    this.clearSelection();
                    this.setStartPoint([lat, lng]);
                }
            }

            this.updateUI();
        });

        // Add zoom event handlers to prevent route clearing during zoom
        this.map.on('zoomstart', () => {
            // Disable click handling during zoom
            this.isZooming = true;
        });

        this.map.on('zoomend', () => {
            // Re-enable click handling after zoom
            setTimeout(() => {
                this.isZooming = false;
            }, 100);
        });
    }

    setStartPoint(coords) {
        this.selectedStart = coords;

        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        this.startMarker = L.marker(coords, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #22c55e, #16a34a);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        color: white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        border: 2px solid white;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                    ">S</div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            })
        }).addTo(this.map);

        // Add popup
        this.startMarker.bindPopup(
            `<div class="marker-popup start-popup">
                <strong>🚀 Start</strong><br>
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
                className: 'custom-marker',
                html: `
                    <div style="
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #dc2626, #b91c1c);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        color: white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        border: 2px solid white;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                    ">E</div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            })
        }).addTo(this.map);

        // Add popup
        this.endMarker.bindPopup(
            `<div class="marker-popup end-popup">
                <strong>🎯 End</strong><br>
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

        // Animate the route drawing first (faster)
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
        // Clear any existing animations
        if (this.currentAnimation) {
            clearTimeout(this.currentAnimation);
        }

        let currentIndex = 0;
        const animationSpeed = 15; // Faster timing (was 30ms)
        const coordinatesPerFrame = 2; // More points per frame (was 1)

        // Set initial state
        polyline.setStyle({
            opacity: 0.8,
            weight: 4
        });

        const animate = () => {
            if (currentIndex < coordinates.length) {
                // Add multiple coordinates per frame for faster drawing
                const endIndex = Math.min(currentIndex + coordinatesPerFrame, coordinates.length);
                const newCoords = coordinates.slice(0, endIndex);
                polyline.setLatLngs(newCoords);

                currentIndex = endIndex;
                this.currentAnimation = setTimeout(animate, animationSpeed);
            } else {
                // Animation complete - simple completion effect
                polyline.setStyle({
                    opacity: 0.9,
                    weight: 5
                });
                this.currentAnimation = null;
            }
        };

        animate();
    }

    addRouteCompletionEffect(polyline) {
        // Simplified completion effect - just a subtle weight increase
        const originalWeight = polyline.options.weight;

        polyline.setStyle({ weight: originalWeight + 2 });

        setTimeout(() => {
            polyline.setStyle({ weight: originalWeight });
        }, 500);
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

            // Animate Dijkstra route (faster timing)
            this.animateComparisonRoute(dijkstraResult.coordinates, dijkstraLayer, 0);
        }

        // Display A* route with reduced delay
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

                // Animate A* route (faster timing)
                this.animateComparisonRoute(astarResult.coordinates, astarLayer, 0);
            }, 800); // Reduced from 1500ms to 800ms
        }

        console.log('Comparison routes displayed');
    }

    animateComparisonRoute(coordinates, polyline, delay = 0) {
        setTimeout(() => {
            let currentIndex = 0;
            const animationSpeed = 10; // Faster for comparison (was 15ms)
            const coordinatesPerFrame = 4; // More points per frame (was 3)

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

    darkenColor(color, factor) {
        // Simple color darkening function
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    lightenColor(color, factor) {
        // Simple color lightening function
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * factor);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * factor);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * factor);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
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
