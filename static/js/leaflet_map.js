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
        this.auxLayers = []; // store temporary layers (circles, partial lines, markers)
        this.bidirectionalAnimating = false;

        this.options = {
            defaultZoom: 13,
            center: [40.7128, -74.0060], // NYC default
            ...options
        };

        this.colors = {
            route: '#3b82f6',
            start: '#22c55e',
            end: '#dc2626',
            bidirectionalForward: '#007bff',
            bidirectionalReverse: '#dc3545',
            meeting: '#8b5cf6'
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
            if (this.isZooming) return;
            const { lat, lng } = e.latlng;

            // Treat any existing route layer OR aux layers as active route state
            const routePresent = !!this.routeLayer || (this.auxLayers && this.auxLayers.length > 0);

            if (routePresent) {
                this.clearSelection();
                this.setStartPoint([lat, lng]);
                this.updateUI();
                return;
            }

            // Normal selection logic when no existing route
            if (!this.selectedStart) {
                this.setStartPoint([lat, lng]);
            } else if (!this.selectedEnd) {
                this.setEndPoint([lat, lng]);
            } else {
                // Both points already set but no route yet; restart selection
                this.clearSelection();
                this.setStartPoint([lat, lng]);
            }

            this.updateUI();
        });

        this.map.on('zoomstart', () => { this.isZooming = true; });
        this.map.on('zoomend', () => { setTimeout(() => { this.isZooming = false; }, 100); });
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
        // Stop any ongoing bidirectional animation
        this.bidirectionalAnimating = false;
        if (this.currentAnimation) {
            clearTimeout(this.currentAnimation);
            this.currentAnimation = null;
        }
        // Clear main route layer
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        // Remove recorded auxiliary layers
        if (this.auxLayers && this.auxLayers.length) {
            this.auxLayers.forEach(l => {
                if (l && this.map.hasLayer(l)) this.map.removeLayer(l);
            });
            this.auxLayers = [];
        }
        // Also remove any remaining polylines that slipped through
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline) {
                this.map.removeLayer(layer);
            }
        });
        console.log('All routes and auxiliary layers cleared from map');
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

    displayComparison(dijkstraResult, astarResult, bidirectionalResult) {
        console.log('Displaying route comparison');

        this.clearRoute();

        const layers = [];

        // Display Dijkstra route first
        if (dijkstraResult && dijkstraResult.coordinates && dijkstraResult.coordinates.length > 0) {
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
            layers.push(dijkstraLayer);
            this.animateComparisonRoute(dijkstraResult.coordinates, dijkstraLayer, 0);
        }

        // Display A* route
        if (astarResult && astarResult.coordinates && astarResult.coordinates.length > 0) {
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
            layers.push(astarLayer);
            this.animateComparisonRoute(astarResult.coordinates, astarLayer, 200);
        }

        // Display Bidirectional route (third) if provided
        if (bidirectionalResult && bidirectionalResult.coordinates && bidirectionalResult.coordinates.length > 0) {
            const biLayer = L.polyline([], {
                color: '#8b5cf6',
                weight: 5,
                opacity: 0,
                dashArray: '2, 6',
                className: 'bidirectional-route'
            }).addTo(this.map);
            biLayer.bindPopup(`
                <div class="route-popup bidirectional-popup">
                    <strong>🟣 Bidirectional</strong><br>
                    Distance: ${bidirectionalResult.total_distance}km<br>
                    Duration: ${bidirectionalResult.duration_minutes}min<br>
                    Nodes Explored: ${bidirectionalResult.nodes_explored}
                </div>
            `);
            layers.push(biLayer);
            this.animateComparisonRoute(bidirectionalResult.coordinates, biLayer, 400);
        }

        // Store layers so they get cleared later
        this.auxLayers.push(...layers);

        // Fit bounds to all layers + markers
        setTimeout(() => {
            const group = new L.featureGroup(layers);
            if (this.startMarker) group.addLayer(this.startMarker);
            if (this.endMarker) group.addLayer(this.endMarker);
            if (layers.length) this.map.fitBounds(group.getBounds().pad(0.15));
        }, 600);

        console.log('Comparison routes displayed (up to 3 algorithms)');
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

    displayBidirectionalRoute(routeData) {
        this.clearRoute();
        if (!routeData.coordinates || routeData.coordinates.length < 2) return;
        this.bidirectionalAnimating = true;

        const coords = routeData.coordinates;
        const forwardExplored = routeData.bidirectional?.forward_explored || [];
        const reverseExplored = routeData.bidirectional?.reverse_explored || [];
        const meeting = routeData.bidirectional?.meeting_node;

        const fullRoute = L.polyline(coords, { color: '#6366f1', weight: 5, opacity: 0 }).addTo(this.map);
        this.routeLayer = fullRoute;

        const forwardLine = L.polyline([], { color: this.colors.bidirectionalForward, weight: 6, opacity: 0.85 }).addTo(this.map);
        const reverseLine = L.polyline([], { color: this.colors.bidirectionalReverse, weight: 6, opacity: 0.85 }).addTo(this.map);
        this.auxLayers.push(forwardLine, reverseLine);

        const explorationGroup = L.layerGroup().addTo(this.map);
        this.auxLayers.push(explorationGroup);
        const haloStyleF = { radius: 6, color: this.colors.bidirectionalForward, weight: 2, fillColor: this.colors.bidirectionalForward, fillOpacity: 0.35 };
        const haloStyleR = { radius: 6, color: this.colors.bidirectionalReverse, weight: 2, fillColor: this.colors.bidirectionalReverse, fillOpacity: 0.35 };

        let meetingIndex = -1;
        if (meeting) {
            let minD = Infinity;
            coords.forEach((c, idx) => {
                const dLat = c[0] - meeting[0];
                const dLng = c[1] - meeting[1];
                const d2 = dLat*dLat + dLng*dLng;
                if (d2 < minD) { minD = d2; meetingIndex = idx; }
            });
        } else {
            meetingIndex = Math.floor(coords.length / 2);
        }

        const forwardSegment = coords.slice(0, meetingIndex + 1);
        const reverseSegment = coords.slice(meetingIndex).reverse();

        let fi = 0, ri = 0;
        const speed = 25;
        const step = () => {
            if (!this.bidirectionalAnimating) return;
            let progressed = false;
            if (fi < forwardSegment.length) {
                forwardLine.addLatLng(forwardSegment[fi]);
                if (forwardExplored[fi]) explorationGroup.addLayer(L.circle(forwardExplored[fi], haloStyleF));
                fi++; progressed = true;
            }
            if (ri < reverseSegment.length) {
                reverseLine.addLatLng(reverseSegment[ri]);
                if (reverseExplored[ri]) explorationGroup.addLayer(L.circle(reverseExplored[ri], haloStyleR));
                ri++; progressed = true;
            }
            if (progressed) {
                requestAnimationFrame(() => setTimeout(step, speed));
            } else {
                if (!this.bidirectionalAnimating) return;
                fullRoute.setStyle({ opacity: 0.9 });
                if (meeting) {
                    const meetMarker = L.marker(meeting, {
                        icon: L.divIcon({
                            className: 'custom-marker',
                            html: `<div style=\"width:20px;height:20px;border-radius:50%;background:#8b5cf6;border:2px solid #fff;box-shadow:0 0 6px rgba(139,92,246,0.6);\"></div>`,
                            iconSize: [20,20],
                            iconAnchor: [10,10]
                        })
                    }).addTo(this.map).bindPopup('<strong>Meeting Point</strong>');
                    this.auxLayers.push(meetMarker);
                }
            }
        };

        setTimeout(() => {
            const group = new L.featureGroup([fullRoute]);
            if (this.startMarker) group.addLayer(this.startMarker);
            if (this.endMarker) group.addLayer(this.endMarker);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }, 50);

        step();
    }

    updateUI() {
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
        const findBtn = document.getElementById('findPathBtn');
        if (findBtn) findBtn.disabled = !(this.selectedStart && this.selectedEnd);
    }

    getSelectedPoints() { return { start: this.selectedStart, end: this.selectedEnd }; }
    hasValidSelection() { return this.selectedStart && this.selectedEnd; }

    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0,2),16) * (1-factor));
        const g = Math.max(0, parseInt(hex.substr(2,2),16) * (1-factor));
        const b = Math.max(0, parseInt(hex.substr(4,2),16) * (1-factor));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const r0 = parseInt(hex.substr(0,2),16), g0 = parseInt(hex.substr(2,2),16), b0 = parseInt(hex.substr(4,2),16);
        const r = Math.min(255, r0 + (255-r0)*factor);
        const g = Math.min(255, g0 + (255-g0)*factor);
        const b = Math.min(255, b0 + (255-b0)*factor);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
}

let leafletMap;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        leafletMap = new LeafletMapComponent('map', { center: [40.7128, -74.0060], defaultZoom: 13 });
        leafletMap.init();
        window.leafletMap = leafletMap;
    }, 100);
});
