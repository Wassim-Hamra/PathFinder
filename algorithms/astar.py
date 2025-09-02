import heapq
import time
import math
from .performance_tracker import PerformanceTracker

def astar_pathfinding(graph, start_id, end_id, constraint='distance', heuristic_weight=1.0, use_bidirectional=False):
    """
    A* algorithm for pathfinding with performance tracking
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

    def heuristic(node_a, node_b):
        """Manhattan distance heuristic"""
        x1, y1 = nodes[node_a]['x'], nodes[node_a]['y']
        x2, y2 = nodes[node_b]['x'], nodes[node_b]['y']
        return abs(x1 - x2) + abs(y1 - y2)

    # Initialize data structures
    g_score = {node_id: float('inf') for node_id in nodes}
    f_score = {node_id: float('inf') for node_id in nodes}
    previous = {node_id: None for node_id in nodes}

    g_score[start_id] = 0
    f_score[start_id] = heuristic_weight * heuristic(start_id, end_id)

    # Priority queue: (f_score, node_id)
    open_set = [(f_score[start_id], start_id)]
    closed_set = set()
    explored_nodes = []

    while open_set:
        current_f, current_node = heapq.heappop(open_set)

        if current_node in closed_set:
            continue

        closed_set.add(current_node)
        explored_nodes.append([nodes[current_node]['x'], nodes[current_node]['y']])
        tracker.increment_nodes_explored()

        # Found the target
        if current_node == end_id:
            break

        # Check neighbors
        for neighbor, weight in adjacency.get(current_node, []):
            if neighbor in closed_set:
                continue

            tentative_g = g_score[current_node] + weight

            if tentative_g < g_score[neighbor]:
                previous[neighbor] = current_node
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic_weight * heuristic(neighbor, end_id)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    # Reconstruct path
    path = []
    current = end_id

    if g_score[end_id] == float('inf'):
        # No path found
        execution_time = tracker.get_execution_time()
        return {
            'algorithm': 'astar',
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
        'algorithm': 'astar',
        'path': path,
        'total_distance': g_score[end_id],
        'execution_time': execution_time,
        'nodes_explored': tracker.nodes_explored,
        'explored_nodes': explored_nodes,
        'path_details': {
            'start': [nodes[start_id]['x'], nodes[start_id]['y']],
            'end': [nodes[end_id]['x'], nodes[end_id]['y']]
        }
    }
