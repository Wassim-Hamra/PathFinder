import math
from typing import List, Tuple, Dict, Set

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate the great circle distance between two points on Earth in kilometers"""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    
    # Convert latitude and longitude from degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of Earth in kilometers
    r = 6371
    
    return c * r

def create_street_network_from_coords(route_coords: List[List[float]], start_coords: List[float], end_coords: List[float]) -> Tuple[Dict, int, int]:
    """
    Create a simplified graph from OSRM route coordinates for algorithm demonstration
    Returns: (graph, start_node_id, end_node_id)
    """
    graph = {}
    
    # Create nodes from route coordinates (sample every few points to make it manageable)
    step = max(1, len(route_coords) // 20)  # Limit to ~20 nodes for performance
    sampled_coords = route_coords[::step]
    
    # Ensure start and end points are included
    if route_coords[0] not in sampled_coords:
        sampled_coords.insert(0, route_coords[0])
    if route_coords[-1] not in sampled_coords:
        sampled_coords.append(route_coords[-1])
    
    # Create graph nodes
    for i, coord in enumerate(sampled_coords):
        graph[i] = {
            'coordinates': coord,
            'neighbors': []
        }
    
    # Connect consecutive nodes
    for i in range(len(sampled_coords) - 1):
        distance = haversine_distance(sampled_coords[i], sampled_coords[i + 1])
        
        # Add bidirectional edges
        graph[i]['neighbors'].append({
            'node': i + 1,
            'weight': distance
        })
        graph[i + 1]['neighbors'].append({
            'node': i,
            'weight': distance
        })
    
    # Find closest nodes to start and end coordinates
    start_node = 0  # First node is closest to start
    end_node = len(sampled_coords) - 1  # Last node is closest to end
    
    return graph, start_node, end_node

def find_closest_node(target_coords: List[float], graph: Dict) -> int:
    """Find the closest node in the graph to the target coordinates"""
    min_distance = float('inf')
    closest_node = None
    
    for node_id, node_data in graph.items():
        distance = haversine_distance(target_coords, node_data['coordinates'])
        if distance < min_distance:
            min_distance = distance
            closest_node = node_id
    
    return closest_node
