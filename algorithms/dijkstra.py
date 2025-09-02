import heapq
import time
from .performance_tracker import PerformanceTracker

def dijkstra_pathfinding(graph, start_id, end_id, constraint='distance'):
    """
    Dijkstra's algorithm for pathfinding with performance tracking
    """
    tracker = PerformanceTracker()
    tracker.start_timing()

    # Get nodes and edges from graph
    nodes = {node['id']: node for node in graph['nodes']}
    edges = graph['edges']

    # Build adjacency list
    adjacency = {}
    for node_id in nodes:
        adjacency[node_id] = []

    for edge in edges:
        source, target = edge['source'], edge['target']
        weight = edge.get(constraint, edge.get('weight', 1))

        adjacency[source].append((target, weight))
        adjacency[target].append((source, weight))  # Undirected graph

    # Initialize distances and previous nodes
    distances = {node_id: float('inf') for node_id in nodes}
    previous = {node_id: None for node_id in nodes}
    distances[start_id] = 0

    # Priority queue: (distance, node_id)
    pq = [(0, start_id)]
    visited = set()
    explored_nodes = []

    while pq:
        current_dist, current_node = heapq.heappop(pq)

        if current_node in visited:
            continue

        visited.add(current_node)
        explored_nodes.append([nodes[current_node]['x'], nodes[current_node]['y']])
        tracker.increment_nodes_explored()

        # Found the target
        if current_node == end_id:
            break

        # Check neighbors
        for neighbor, weight in adjacency.get(current_node, []):
            if neighbor not in visited:
                new_dist = current_dist + weight

                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = current_node
                    heapq.heappush(pq, (new_dist, neighbor))

    # Reconstruct path
    path = []
    current = end_id

    if distances[end_id] == float('inf'):
        # No path found
        execution_time = tracker.get_execution_time()
        return {
            'algorithm': 'dijkstra',
            'path': [],
            'total_distance': 0,
            'execution_time': execution_time,
            'nodes_explored': tracker.nodes_explored,
            'explored_nodes': explored_nodes,
            'error': 'No path found'
        }

    while current is not None:
        path.append([nodes[current]['x'], nodes[current]['y']])
        current = previous[current]

    path.reverse()
    execution_time = tracker.get_execution_time()

    return {
        'algorithm': 'dijkstra',
        'path': path,
        'total_distance': distances[end_id],
        'execution_time': execution_time,
        'nodes_explored': tracker.nodes_explored,
        'explored_nodes': explored_nodes,
        'path_details': {
            'start': [nodes[start_id]['x'], nodes[start_id]['y']],
            'end': [nodes[end_id]['x'], nodes[end_id]['y']]
        }
    }
