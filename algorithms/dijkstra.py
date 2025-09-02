import heapq
import time
from typing import Dict, List, Tuple, Optional
from .graph_utils import haversine_distance

def dijkstra_pathfinding(graph: Dict, start_node: int, end_node: int) -> Tuple[List[int], int]:
    """
    Dijkstra's algorithm implementation for finding shortest path
    Returns: (path, nodes_explored)
    """
    distances = {node: float('inf') for node in graph}
    distances[start_node] = 0
    previous = {}
    visited = set()
    priority_queue = [(0, start_node)]
    nodes_explored = 0

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        if current_node in visited:
            continue

        visited.add(current_node)
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
                distances[neighbor] = new_distance
                previous[neighbor] = current_node
                heapq.heappush(priority_queue, (new_distance, neighbor))

    # Reconstruct path
    path = []
    current = end_node

    if current not in previous and current != start_node:
        return [], nodes_explored  # No path found

    while current is not None:
        path.append(current)
        current = previous.get(current)

    path.reverse()

    return path, nodes_explored
