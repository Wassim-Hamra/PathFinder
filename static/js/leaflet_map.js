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
                className: 'custom-marker start-marker',
                html: `
                    <div class="simple-marker start-marker-circle">
                        <div class="marker-inner">S</div>
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12], // Center the marker on click position
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
                className: 'custom-marker end-marker',
                html: `
                    <div class="simple-marker end-marker-circle">
                        <div class="marker-inner">E</div>
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12], // Center the marker on click position
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
        let progress = 0; // Track progress between points
        const carSpeed = 5; // Much faster timing (was 8ms)
        const progressStep = 0.3; // Larger steps for faster movement (was 0.2)

        const animateCar = () => {
            if (currentIndex < coordinates.length - 1) {
                const currentPos = coordinates[currentIndex];
                const nextPos = coordinates[currentIndex + 1];

                // Interpolate between current and next position
                const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * progress;
                const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * progress;

                // Calculate bearing for car rotation
                const bearing = this.calculateBearing(currentPos, nextPos);

                // Update car position and rotation
                carMarker.setLatLng([lat, lng]);
                this.rotateCarIcon(carMarker, bearing);

                // Advance progress
                progress += progressStep;

                // Move to next segment when current one is complete
                if (progress >= 1) {
                    progress = 0;
                    currentIndex++;
                }

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
            const carContainer = icon.querySelector('.car-container-3d') || icon.querySelector('.car-container');
            if (carContainer) {
                carContainer.style.transform = `rotate(${bearing}deg)`;
            }
        }
    }

    calculateBearing(start, end) {
        const startLat = start[0] * Math.PI / 180;
        const startLng = start[1] * Math.PI / 180;
        const endLat = end[0] * Math.PI / 180;
        const endLng = end[1] * Math.PI / 180;

        const dLng = endLng - startLng;

        const y = Math.sin(dLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;

        // Normalize bearing to 0-360 degrees
        bearing = (bearing + 360) % 360;

        return bearing;
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
        const shadowColor = this.darkenColor(color, 0.3);

        return L.divIcon({
            className: 'car-marker-3d',
            html: `
                <div class="car-container-3d" style="transform: rotate(0deg);">
                    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <!-- Car Shadow -->
                        <ellipse cx="16" cy="28" rx="12" ry="2" fill="rgba(0,0,0,0.3)"/>
                        
                        <!-- Car Body -->
                        <rect x="6" y="12" width="20" height="10" rx="2" fill="${color}" stroke="white" stroke-width="1"/>
                        
                        <!-- Car Roof -->
                        <rect x="10" y="8" width="12" height="8" rx="3" fill="${color}" stroke="white" stroke-width="1"/>
                        
                        <!-- Windshield -->
                        <rect x="10" y="8" width="12" height="3" rx="2" fill="#87CEEB" opacity="0.8"/>
                        
                        <!-- Headlights -->
                        <circle cx="24" cy="14" r="1.5" fill="#FFFFFF" stroke="#DDD"/>
                        <circle cx="24" cy="18" r="1.5" fill="#FFFFFF" stroke="#DDD"/>
                        
                        <!-- Rear lights -->
                        <circle cx="8" cy="14" r="1" fill="#FF4444"/>
                        <circle cx="8" cy="18" r="1" fill="#FF4444"/>
                        
                        <!-- Wheels -->
                        <circle cx="11" cy="23" r="2.5" fill="#333" stroke="#666"/>
                        <circle cx="21" cy="23" r="2.5" fill="#333" stroke="#666"/>
                        <circle cx="11" cy="23" r="1.5" fill="#666"/>
                        <circle cx="21" cy="23" r="1.5" fill="#666"/>
                    </svg>
                    <div class="car-shadow-3d"></div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
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
