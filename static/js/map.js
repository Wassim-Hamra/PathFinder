            });
            
            const data = await response.json();
            if (data.success) {
                this.loadGraphData();
                this.showSuccess(`Generated new graph with ${data.nodes} nodes and ${data.edges} edges`);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error generating new graph:', error);
            this.showError('Failed to generate new graph');
        }
    }
    
    showError(message) {
        // You can implement a toast notification system here
        alert('Error: ' + message);
    }
    
    showSuccess(message) {
        // You can implement a toast notification system here
        console.log('Success: ' + message);
    }
}

// Initialize map when Google Maps API is loaded
function initMap() {
    window.routeMap = new RouteOptimizerMap();
}

// Fallback initialization
document.addEventListener('DOMContentLoaded', () => {
    // If Google Maps is already loaded
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
    }
});
// Route Optimizer Map Functionality
class RouteOptimizerMap {
    constructor() {
        this.map = null;
        this.graph = null;
        this.nodes = new Map();
        this.edges = [];
        this.selectedStart = null;
        this.selectedEnd = null;
        this.currentPath = [];
        this.exploredNodes = [];
        this.bounds = null;
        this.scenarios = [];
        
        this.initializeMap();
        this.loadGraphData();
        this.setupEventListeners();
    }
    
    initializeMap() {
        // Initialize the map with a default view
        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 12,
            center: { lat: 37.7749, lng: -122.4194 }, // San Francisco default
            mapTypeId: 'roadmap',
            styles: this.getMapStyles(),
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true
        });
        
        // Add click listener for node selection
        this.map.addListener('click', (event) => {
            this.handleMapClick(event);
        });
    }
    
    getMapStyles() {
        // Custom map styling for better visualization
        return [
            {
                "featureType": "all",
                "elementType": "geometry.fill",
                "stylers": [{"weight": "2.00"}]
            },
            {
                "featureType": "all",
                "elementType": "geometry.stroke",
                "stylers": [{"color": "#9c9c9c"}]
            },
            {
                "featureType": "all",
                "elementType": "labels.text",
                "stylers": [{"visibility": "on"}]
            },
            {
                "featureType": "landscape",
                "elementType": "all",
                "stylers": [{"color": "#f2f2f2"}]
            },
            {
                "featureType": "poi",
                "elementType": "all",
                "stylers": [{"visibility": "off"}]
            },
            {
                "featureType": "road",
                "elementType": "all",
                "stylers": [{"saturation": -100}, {"lightness": 45}]
            },
            {
                "featureType": "water",
                "elementType": "all",
                "stylers": [{"color": "#46bcec"}, {"visibility": "on"}]
            }
        ];
    }
    
    async loadGraphData() {
        try {
            const response = await fetch('/api/graph');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.graph = data.graph;
            this.bounds = data.bounds;
            this.scenarios = data.scenarios;
            
            this.renderGraph();
            this.fitMapToBounds();
            this.populateScenarios();
            
        } catch (error) {
            console.error('Error loading graph data:', error);
            this.showError('Failed to load graph data. Please refresh the page.');
        }
    }
    
    renderGraph() {
        this.clearMap();
        
        // Render edges first (so they appear behind nodes)
        this.renderEdges();
        
        // Render nodes
        this.renderNodes();
    }
    
    renderNodes() {
        this.graph.nodes.forEach(node => {
            const marker = new google.maps.Marker({
                position: { lat: node.y, lng: node.x },
                map: this.map,
                title: node.name,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#2196F3',
                    fillOpacity: 0.8,
                    strokeColor: '#1976D2',
                    strokeWeight: 2,
                    scale: 6
                }
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div>
                        <strong>${node.name}</strong><br>
                        <small>Node ID: ${node.id}</small><br>
                        <small>Coordinates: (${node.x.toFixed(2)}, ${node.y.toFixed(2)})</small>
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                this.selectNode(node.id, marker);
                infoWindow.open(this.map, marker);
            });
            
            this.nodes.set(node.id, { node, marker, infoWindow });
        });
    }
    
    renderEdges() {
        this.graph.edges.forEach(edge => {
            const fromNode = this.graph.nodes.find(n => n.id === edge.from);
            const toNode = this.graph.nodes.find(n => n.id === edge.to);
            
            if (fromNode && toNode) {
                const polyline = new google.maps.Polyline({
                    path: [
                        { lat: fromNode.y, lng: fromNode.x },
                        { lat: toNode.y, lng: toNode.x }
                    ],
                    geodesic: false,
                    strokeColor: edge.type === 'highway' ? '#FF5722' : '#2196F3',
                    strokeOpacity: 0.6,
                    strokeWeight: edge.type === 'highway' ? 4 : 2,
                    map: this.map
                });
                
                this.edges.push({ edge, polyline });
            }
        });
    }
    
    fitMapToBounds() {
        if (this.bounds) {
            const mapBounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(this.bounds.min_y, this.bounds.min_x),
                new google.maps.LatLng(this.bounds.max_y, this.bounds.max_x)
            );
            this.map.fitBounds(mapBounds);
            
            // Add some padding
            setTimeout(() => {
                this.map.setZoom(this.map.getZoom() - 1);
            }, 100);
        }
    }
    
    handleMapClick(event) {
        const clickedLat = event.latLng.lat();
        const clickedLng = event.latLng.lng();
        
        // Find nearest node
        this.findNearestNode(clickedLng, clickedLat);
    }
    
    async findNearestNode(x, y) {
        try {
            const response = await fetch('/api/nearest-node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y })
            });
            
            const data = await response.json();
            if (data.node_id) {
                const nodeData = this.nodes.get(data.node_id);
                if (nodeData) {
                    this.selectNode(data.node_id, nodeData.marker);
                }
            }
        } catch (error) {
            console.error('Error finding nearest node:', error);
        }
    }
    
    selectNode(nodeId, marker) {
        if (!this.selectedStart) {
            this.setStartNode(nodeId, marker);
        } else if (!this.selectedEnd && nodeId !== this.selectedStart) {
            this.setEndNode(nodeId, marker);
        } else if (nodeId === this.selectedStart) {
            this.clearStartNode();
        } else if (nodeId === this.selectedEnd) {
            this.clearEndNode();
        } else {
            // Replace end node
            this.clearEndNode();
            this.setEndNode(nodeId, marker);
        }
        
        this.updateControlPanel();
    }
    
    setStartNode(nodeId, marker) {
        this.selectedStart = nodeId;
        marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#4CAF50',
            fillOpacity: 1,
            strokeColor: '#2E7D32',
            strokeWeight: 3,
            scale: 8
        });
        
        const nodeData = this.nodes.get(nodeId);
        document.getElementById('startNode').value = nodeData.node.name;
    }
    
    setEndNode(nodeId, marker) {
        this.selectedEnd = nodeId;
        marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#F44336',
            fillOpacity: 1,
            strokeColor: '#C62828',
            strokeWeight: 3,
            scale: 8
        });
        
        const nodeData = this.nodes.get(nodeId);
        document.getElementById('endNode').value = nodeData.node.name;
    }
    
    clearStartNode() {
        if (this.selectedStart) {
            const nodeData = this.nodes.get(this.selectedStart);
            nodeData.marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#2196F3',
                fillOpacity: 0.8,
                strokeColor: '#1976D2',
                strokeWeight: 2,
                scale: 6
            });
            this.selectedStart = null;
            document.getElementById('startNode').value = '';
        }
    }
    
    clearEndNode() {
        if (this.selectedEnd) {
            const nodeData = this.nodes.get(this.selectedEnd);
            nodeData.marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#2196F3',
                fillOpacity: 0.8,
                strokeColor: '#1976D2',
                strokeWeight: 2,
                scale: 6
            });
            this.selectedEnd = null;
            document.getElementById('endNode').value = '';
        }
    }
    
    clearSelection() {
        this.clearStartNode();
        this.clearEndNode();
        this.clearPath();
        this.clearExploredNodes();
        this.updateControlPanel();
    }
    
    clearPath() {
        this.currentPath.forEach(polyline => {
            polyline.setMap(null);
        });
        this.currentPath = [];
    }
    
    clearExploredNodes() {
        this.exploredNodes.forEach(marker => {
            marker.setMap(null);
        });
        this.exploredNodes = [];
    }
    
    displayPath(path, color = '#4CAF50', weight = 6) {
        this.clearPath();
        
        if (path.length < 2) return;
        
        for (let i = 0; i < path.length - 1; i++) {
            const fromNodeData = this.nodes.get(path[i]);
            const toNodeData = this.nodes.get(path[i + 1]);
            
            if (fromNodeData && toNodeData) {
                const polyline = new google.maps.Polyline({
                    path: [
                        { lat: fromNodeData.node.y, lng: fromNodeData.node.x },
                        { lat: toNodeData.node.y, lng: toNodeData.node.x }
                    ],
                    geodesic: false,
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    strokeWeight: weight,
                    map: this.map,
                    zIndex: 1000
                });
                
                this.currentPath.push(polyline);
            }
        }
    }
    
    animateAlgorithmExecution(visitedNodes) {
        return new Promise((resolve) => {
            let index = 0;
            const animationSpeed = parseInt(document.getElementById('visualizationSpeed')?.value || 200);
            
            const animate = () => {
                if (index < visitedNodes.length) {
                    const nodeId = visitedNodes[index];
                    const nodeData = this.nodes.get(nodeId);
                    
                    if (nodeData && nodeId !== this.selectedStart && nodeId !== this.selectedEnd) {
                        // Create exploration marker
                        const explorationMarker = new google.maps.Marker({
                            position: { lat: nodeData.node.y, lng: nodeData.node.x },
                            map: this.map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                fillColor: '#FFC107',
                                fillOpacity: 0.7,
                                strokeColor: '#FF8F00',
                                strokeWeight: 2,
                                scale: 4
                            },
                            zIndex: 500
                        });
                        
                        this.exploredNodes.push(explorationMarker);
                    }
                    
                    index++;
                    setTimeout(animate, animationSpeed);
                } else {
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    updateControlPanel() {
        const hasSelection = this.selectedStart && this.selectedEnd;
        document.getElementById('findPathBtn').disabled = !hasSelection;
        document.getElementById('visualizeBtn').disabled = !hasSelection;
        document.getElementById('exportBtn').disabled = this.currentPath.length === 0;
    }
    
    populateScenarios() {
        const scenarioSelect = document.getElementById('scenarioSelect');
        scenarioSelect.innerHTML = '<option value="">Select a scenario...</option>';
        
        this.scenarios.forEach((scenario, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${scenario.type}: ${scenario.start_name} → ${scenario.end_name}`;
            scenarioSelect.appendChild(option);
        });
    }
    
    loadScenario(scenarioIndex) {
        const scenario = this.scenarios[scenarioIndex];
        if (scenario) {
            this.clearSelection();
            
            setTimeout(() => {
                const startNodeData = this.nodes.get(scenario.start);
                const endNodeData = this.nodes.get(scenario.end);
                
                if (startNodeData && endNodeData) {
                    this.selectNode(scenario.start, startNodeData.marker);
                    this.selectNode(scenario.end, endNodeData.marker);
                }
            }, 100);
        }
    }
    
    clearMap() {
        // Clear existing markers and polylines
        this.nodes.forEach(nodeData => {
            nodeData.marker.setMap(null);
        });
        this.nodes.clear();
        
        this.edges.forEach(edgeData => {
            edgeData.polyline.setMap(null);
        });
        this.edges = [];
        
        this.clearPath();
        this.clearExploredNodes();
    }
    
    setupEventListeners() {
        // Algorithm selection change
        document.getElementById('algorithmSelect').addEventListener('change', (e) => {
            const astarOptions = document.getElementById('astarOptions');
            astarOptions.style.display = (e.target.value === 'astar' || e.target.value === 'compare') ? 'block' : 'none';
        });
        
        // Heuristic weight slider
        const heuristicSlider = document.getElementById('heuristicWeight');
        const heuristicValue = document.getElementById('heuristicValue');
        
        if (heuristicSlider && heuristicValue) {
            heuristicSlider.addEventListener('input', (e) => {
                heuristicValue.textContent = e.target.value;
            });
        }
        
        // Clear nodes button
        document.getElementById('clearNodes').addEventListener('click', () => {
            this.clearSelection();
        });
        
        // Scenario selection
        document.getElementById('scenarioSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadScenario(parseInt(e.target.value));
            }
        });
        
        // Generate new graph
        document.getElementById('generateGraphBtn').addEventListener('click', () => {
            this.generateNewGraph();
        });
    }
    
    async generateNewGraph() {
        try {
            const response = await fetch('/api/generate-new-graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    num_nodes: 300,
                    connectivity: 0.25,
                    width: 200,
                    height: 200
                })

