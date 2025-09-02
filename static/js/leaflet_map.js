/**
 * Interactive Leaflet Map Component for Real Street Route Visualization
 * Uses direct OSRM API for reliable street routing
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

        // Initialize route layer
        this.routeLayer = L.layerGroup().addTo(this.map);

        // Add map resize handler
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }

    setupMapClickHandler() {
        if (!this.map) return;

        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.selectPoint([lat, lng]);
        });
    }

    selectPoint(coords) {
        if (!this.selectedStart) {
            // Set start point
            this.selectedStart = coords;
            this.addStartMarker(coords);
            this.showInfo('Start point selected. Click another location to set the end point.');
        } else if (!this.selectedEnd) {
            // Set end point
            this.selectedEnd = coords;
            this.addEndMarker(coords);
            this.showInfo('End point selected. Click "Find Route" to calculate the route.');
            this.enableFindButton();
        } else {
            // Reset and set new start point
            this.clearSelection();
            this.selectedStart = coords;
            this.addStartMarker(coords);
            this.showInfo('Start point reset. Click another location to set the end point.');
        }

        // Update selection status in UI
        if (window.updateSelectionStatus) {
            window.updateSelectionStatus();
        }
    }

    addStartMarker(coords) {
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        this.startMarker = L.marker(coords, {
            icon: L.divIcon({
                html: '<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                className: 'custom-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        this.startMarker.bindPopup('<b>Start Point</b>').openPopup();
    }

    addEndMarker(coords) {
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }

        this.endMarker = L.marker(coords, {
            icon: L.divIcon({
                html: '<div style="background-color: #dc2626; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                className: 'custom-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        this.endMarker.bindPopup('<b>End Point</b>').openPopup();
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
        this.disableFindButton();

        // Update selection status in UI
        if (window.updateSelectionStatus) {
            window.updateSelectionStatus();
        }
    }

    clearRoute() {
        if (this.routeLayer) {
            this.routeLayer.clearLayers();
        }
    }

    async findRoute(algorithm = 'fastest') {
        if (!this.selectedStart || !this.selectedEnd) {
            throw new Error('Start and end points must be selected');
        }

        const start = this.selectedStart;
        const end = this.selectedEnd;

        // Determine routing profile
        const profile = algorithm === 'shortest' ? 'foot' : 'driving';

        try {
            // Use OSRM API directly for real street routing
            const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

            console.log('Calling OSRM API:', osrmUrl);

            const response = await fetch(osrmUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`OSRM API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('OSRM Response:', data);

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Convert [lng,lat] to [lat,lng]

                console.log(`Route found: ${coordinates.length} waypoints, ${route.distance}m, ${route.duration}s`);

                // Create route data object
                const routeData = {
                    coordinates: coordinates,
                    distance: route.distance,
                    duration: route.duration,
                    algorithm: algorithm
                };

                // Display the route on the map
                this.displayStreetRoute(routeData);

                return {
                    algorithm: algorithm,
                    distance: route.distance,
                    duration: route.duration,
                    coordinates: coordinates,
                    service: 'OSRM (Real Streets)'
                };
            } else {
                console.error('OSRM returned no valid routes:', data);
                throw new Error(`No route found: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('OSRM routing failed:', error);

            // Fallback to simple demonstration route for testing
            console.log('Falling back to demo route for testing...');
            return this.createFallbackRoute(start, end, algorithm);
        }
    }

    createFallbackRoute(start, end, algorithm) {
        // Create a simple route for testing when OSRM fails
        const waypoints = [start];

        // Add some intermediate points to simulate a street route
        const steps = 5;
        for (let i = 1; i < steps; i++) {
            const progress = i / steps;
            const lat = start[0] + (end[0] - start[0]) * progress;
            const lng = start[1] + (end[1] - start[1]) * progress;
            waypoints.push([lat, lng]);
        }

        waypoints.push(end);

        // Calculate approximate distance
        let totalDistance = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            totalDistance += this.calculateDistance(waypoints[i], waypoints[i + 1]);
        }

        const routeData = {
            coordinates: waypoints,
            distance: totalDistance * 1000, // Convert to meters
            duration: (totalDistance / 30) * 3600, // Assume 30 km/h average speed
            algorithm: algorithm
        };

        this.displayStreetRoute(routeData);

        return {
            algorithm: algorithm,
            distance: routeData.distance,
            duration: routeData.duration,
            coordinates: waypoints,
            service: 'Fallback Demo',
            note: 'OSRM API unavailable, showing demo route'
        };
    }

    calculateDistance(coord1, coord2) {
        // Haversine formula for distance calculation
        const lat1 = coord1[0] * Math.PI / 180;
        const lon1 = coord1[1] * Math.PI / 180;
        const lat2 = coord2[0] * Math.PI / 180;
        const lon2 = coord2[1] * Math.PI / 180;

        const dlat = lat2 - lat1;
        const dlon = lon2 - lon1;

        const a = Math.sin(dlat/2) * Math.sin(dlat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dlon/2) * Math.sin(dlon/2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const R = 6371; // Earth's radius in km

        return R * c;
    }

    displayRoute(routeData) {
        // Alias for displayStreetRoute to maintain compatibility
        return this.displayStreetRoute(routeData);
    }

    displayStreetRoute(routeData) {
        // Clear any existing route
        this.clearRoute();

        // Draw the route line
        const routeLine = L.polyline(routeData.coordinates, {
            color: this.colors.route,
            weight: 4,
            opacity: 0.8
        }).addTo(this.routeLayer);

        // Fit map to show the route
        const group = new L.featureGroup([routeLine]);
        if (this.startMarker) group.addLayer(this.startMarker);
        if (this.endMarker) group.addLayer(this.endMarker);

        this.map.fitBounds(group.getBounds().pad(0.1));

        console.log('Street route displayed successfully');
    }

    enableFindButton() {
        const findBtn = document.getElementById('findPathBtn');
        if (findBtn) {
            findBtn.disabled = false;
        }
    }

    disableFindButton() {
        const findBtn = document.getElementById('findPathBtn');
        if (findBtn) {
            findBtn.disabled = true;
        }
    }

    showInfo(message) {
        console.log('Info:', message);

        // Show toast instead of popup to avoid interfering with map
        if (window.algorithmManager) {
            window.algorithmManager.showToast(message, 'info');
        }
    }

    resize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

// Export for global use
window.LeafletMapComponent = LeafletMapComponent;
