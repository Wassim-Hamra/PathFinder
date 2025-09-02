import heapq
import time
from typing import Dict, List, Tuple, Optional
from .graph_utils import haversine_distance
from .performance_tracker import PerformanceTracker

def dijkstra_pathfinding(graph: Dict, start_node: int, end_node: int, tracker: Optional[PerformanceTracker] = None) -> Tuple[List[int], int, Optional[PerformanceTracker]]:
    """
    Dijkstra's algorithm implementation for finding shortest path
    Returns: (path, nodes_explored, performance_tracker)
    """
    if tracker is None:
        tracker = PerformanceTracker()

    tracker.set_algorithm_name("Dijkstra")
    tracker.set_graph_metrics(len(graph), sum(len(node['neighbors']) for node in graph.values()))
    tracker.start_timing()

    distances = {node: float('inf') for node in graph}
    distances[start_node] = 0
    previous = {}
    visited = set()
    priority_queue = [(0, start_node)]
    nodes_explored = 0

    # Track memory usage (approximate)
    tracker.update_memory_usage(len(distances) + len(previous) + len(visited) + len(priority_queue))

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)
        tracker.increment_priority_queue_ops()

        if current_node in visited:
            continue

        visited.add(current_node)
        tracker.increment_nodes_explored()
        nodes_explored += 1

        # If we reached the destination
        if current_node == end_node:
            break

        # Check neighbors
        for neighbor_info in graph[current_node]['neighbors']:
            neighbor = neighbor_info['node']
            weight = neighbor_info['weight']

            if neighbor in visited:
                continue

            new_distance = current_distance + weight

            if new_distance < distances[neighbor]:
                # Edge relaxation occurred
                tracker.increment_edges_relaxed()
                distances[neighbor] = new_distance
                previous[neighbor] = current_node
                heapq.heappush(priority_queue, (new_distance, neighbor))
                tracker.increment_priority_queue_ops()

                # Update memory usage tracking
                tracker.update_memory_usage(len(distances) + len(previous) + len(visited) + len(priority_queue))

    tracker.stop_timing()

    # Reconstruct path
    path = []
    current = end_node

    if current not in previous and current != start_node:
        return [], nodes_explored, tracker  # No path found

    while current is not None:
        path.append(current)
        current = previous.get(current)

    path.reverse()

    return path, nodes_explored, tracker
