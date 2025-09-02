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
        this.carMarkers = []; // Track animated car markers
        this.carAnimations = []; // Track car animation timeouts

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
                // If route exists and user deliberately clicks, ask for confirmation
                // Only clear if click is far from existing markers
                const startDistance = this.selectedStart ?
                    this.map.distance(e.latlng, L.latLng(this.selectedStart[0], this.selectedStart[1])) : Infinity;
                const endDistance = this.selectedEnd ?
                    this.map.distance(e.latlng, L.latLng(this.selectedEnd[0], this.selectedEnd[1])) : Infinity;

                // Only reset if click is more than 100 meters from existing markers
                if (startDistance > 100 && endDistance > 100) {
                    // Show confirmation before clearing
                    if (confirm('Clear current route and set new start point?')) {
                        this.clearSelection();
                        this.setStartPoint([lat, lng]);
                    }
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
                iconAnchor: [20, 50], // Pin tip at exact click position
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
                iconAnchor: [20, 50], // Pin tip at exact click position
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

        // Clear car markers and animations
        this.clearCarAnimations();

        // Clear any comparison route layers
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && layer !== this.routeLayer) {
                // Remove any polyline that's not the main route (comparison routes)
                this.map.removeLayer(layer);
            }
        });

        console.log('All routes cleared from map');
    }

    clearCarAnimations() {
        // Stop all car animations
        this.carAnimations.forEach(animation => {
            if (animation) clearTimeout(animation);
        });
        this.carAnimations = [];

        // Remove all car markers
        this.carMarkers.forEach(marker => {
            if (marker) this.map.removeLayer(marker);
        });
        this.carMarkers = [];
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

        // Start car animation sooner after route starts drawing
        setTimeout(() => {
            this.animateCar(routeData.coordinates, routeData.algorithm || 'default');
        }, 500); // Reduced from 1000ms to 500ms

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

    animateCar(coordinates, algorithm) {
        if (!coordinates || coordinates.length < 2) return;

        // Create car marker
        const carMarker = L.marker(coordinates[0], {
            icon: this.createCarIcon(algorithm),
            zIndexOffset: 1000 // Ensure car appears above route
        }).addTo(this.map);

        this.carMarkers.push(carMarker);

        let currentIndex = 0;
        const carSpeed = 25; // Faster car movement (was 50ms)

        const animateCar = () => {
            if (currentIndex < coordinates.length - 1) {
                const currentPos = coordinates[currentIndex];
                const nextPos = coordinates[currentIndex + 1];

                // Calculate bearing for car rotation
                const bearing = this.calculateBearing(currentPos, nextPos);

                // Update car position and rotation
                carMarker.setLatLng(nextPos);
                this.rotateCarIcon(carMarker, bearing);

                currentIndex++;
                const timeout = setTimeout(animateCar, carSpeed);
                this.carAnimations.push(timeout);
            } else {
                // Car reached destination - add completion effect
                this.addCarCompletionEffect(carMarker);
            }
        };

        // Start car animation
        animateCar();
    }

    rotateCarIcon(marker, bearing) {
        const icon = marker.getElement();
        if (icon) {
            const carContainer = icon.querySelector('.car-container');
            if (carContainer) {
                carContainer.style.transform = `rotate(${bearing}deg)`;
            }
        }
    }

    addCarCompletionEffect(carMarker) {
        // Add a bounce effect when car reaches destination
        const icon = carMarker.getElement();
        if (icon) {
            icon.style.animation = 'carBounce 0.6s ease-in-out';

            // Remove animation class after completion
            setTimeout(() => {
                if (icon) {
                    icon.style.animation = '';
                }
            }, 600);
        }
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

            // Animate Dijkstra route and car (faster timing)
            this.animateComparisonRoute(dijkstraResult.coordinates, dijkstraLayer, 0);
            setTimeout(() => {
                this.animateCar(dijkstraResult.coordinates, 'dijkstra');
            }, 400); // Reduced from 800ms to 400ms
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

                // Animate A* route and car (faster timing)
                this.animateComparisonRoute(astarResult.coordinates, astarLayer, 0);
                setTimeout(() => {
                    this.animateCar(astarResult.coordinates, 'astar');
                }, 400); // Reduced from 800ms to 400ms
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

    createCarIcon(algorithm) {
        const colors = {
            dijkstra: '#dc2626',  // Red car for Dijkstra
            astar: '#2563eb',     // Blue car for A*
            default: '#22c55e'    // Green car for single algorithm
        };

        const color = colors[algorithm] || colors.default;

        return L.divIcon({
            className: 'car-marker',
            html: `
                <div class="car-container" style="transform: rotate(0deg);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1">
                        <path d="M7 17h10v2H7v-2zM7 5h10v2H7V5zM7 9h10v2H7V9zM7 13h10v2H7v-2z"/>
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="${color}" stroke="white" stroke-width="1"/>
                        <circle cx="9" cy="8" r="1" fill="white"/>
                        <circle cx="15" cy="8" r="1" fill="white"/>
                        <rect x="8" y="10" width="8" height="4" rx="1" fill="white" opacity="0.8"/>
                    </svg>
                    <div class="car-shadow"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    calculateBearing(start, end) {
        const lat1 = start[0] * Math.PI / 180;
        const lat2 = end[0] * Math.PI / 180;
        const deltaLng = (end[1] - start[1]) * Math.PI / 180;

        const x = Math.sin(deltaLng) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

        const bearing = Math.atan2(x, y) * 180 / Math.PI;
        return (bearing + 360) % 360;
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
