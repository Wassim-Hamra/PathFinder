import heapq
import time
from typing import Dict, List, Tuple, Optional
from .graph_utils import haversine_distance

def astar_pathfinding(graph: Dict, start_node: int, end_node: int) -> Tuple[List[int], int]:
    """
    A* algorithm implementation for finding shortest path with heuristic
    Returns: (path, nodes_explored)
    """
    def heuristic(node1: int, node2: int) -> float:
        """Calculate heuristic distance between two nodes"""
        coord1 = graph[node1]['coordinates']
        coord2 = graph[node2]['coordinates']
        return haversine_distance(coord1, coord2)

    open_set = [(0, start_node)]
    came_from = {}
    g_score = {node: float('inf') for node in graph}
    g_score[start_node] = 0
    f_score = {node: float('inf') for node in graph}
    f_score[start_node] = heuristic(start_node, end_node)
    nodes_explored = 0

    while open_set:
        current_f, current_node = heapq.heappop(open_set)
        nodes_explored += 1

        # If we reached the destination
        if current_node == end_node:
            break

        # Check neighbors
        for neighbor_info in graph[current_node]['neighbors']:
            neighbor = neighbor_info['node']
            weight = neighbor_info['weight']

            tentative_g_score = g_score[current_node] + weight

            if tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current_node
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = g_score[neighbor] + heuristic(neighbor, end_node)

                # Add to open set if not already there
                if (f_score[neighbor], neighbor) not in open_set:
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))

    # Reconstruct path
    path = []
    current = end_node

    if current not in came_from and current != start_node:
        return [], nodes_explored  # No path found

    while current is not None:
        path.append(current)
        current = came_from.get(current)

    path.reverse()

    return path, nodes_explored
