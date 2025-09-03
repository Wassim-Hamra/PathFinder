import heapq
from typing import Dict, List, Tuple, Optional
from .performance_tracker import PerformanceTracker

"""Bidirectional Dijkstra implementation for undirected weighted graphs with positive weights.
Returns (path, nodes_explored, tracker)
Graph format: { node_id: { 'coordinates': [lat,lng], 'neighbors': [ {'node': id, 'weight': w}, ... ] } }
"""

def bidirectional_dijkstra_pathfinding(graph: Dict, start_node: int, end_node: int, tracker: Optional[PerformanceTracker] = None) -> Tuple[List[int], int, PerformanceTracker]:
    if tracker is None:
        tracker = PerformanceTracker()

    tracker.set_algorithm_name("Bidirectional")
    tracker.set_graph_metrics(len(graph), sum(len(node['neighbors']) for node in graph.values()))
    tracker.start_timing()

    if start_node == end_node:
        tracker.increment_nodes_explored()
        tracker.stop_timing()
        return [start_node], 1, tracker

    # Distances and predecessor maps for both searches
    dist_fwd = {n: float('inf') for n in graph}
    dist_rev = {n: float('inf') for n in graph}
    dist_fwd[start_node] = 0
    dist_rev[end_node] = 0

    prev_fwd = {}
    prev_rev = {}

    # Priority queues (distance, node)
    pq_fwd = [(0, start_node)]
    pq_rev = [(0, end_node)]

    visited_fwd = set()
    visited_rev = set()

    best_meet = None
    best_distance = float('inf')

    nodes_explored = 0

    def relax(current_node, neighbor_info, dist_map, other_dist_map, prev_map, pq):
        nonlocal best_meet, best_distance
        neighbor = neighbor_info['node']
        weight = neighbor_info['weight']
        new_d = dist_map[current_node] + weight
        if new_d < dist_map[neighbor]:
            dist_map[neighbor] = new_d
            prev_map[neighbor] = current_node
            heapq.heappush(pq, (new_d, neighbor))
            tracker.increment_priority_queue_ops()
            tracker.increment_edges_relaxed()
            tracker.update_memory_usage(len(prev_fwd)+len(prev_rev)+len(pq_fwd)+len(pq_rev))
            # If neighbor also seen from opposite search update best path
            if other_dist_map[neighbor] < float('inf'):
                total = new_d + other_dist_map[neighbor]
                if total < best_distance:
                    best_distance = total
                    best_meet = neighbor

    while pq_fwd and pq_rev:
        # Expand forward step
        if pq_fwd:
            d, node = heapq.heappop(pq_fwd)
            tracker.increment_priority_queue_ops()
            if node not in visited_fwd:
                visited_fwd.add(node)
                tracker.record_forward_node(node)
                tracker.increment_nodes_explored()
                nodes_explored += 1
                for nb in graph[node]['neighbors']:
                    if nb['node'] not in visited_fwd:
                        relax(node, nb, dist_fwd, dist_rev, prev_fwd, pq_fwd)
        # Termination check
        if best_meet is not None and dist_fwd.get(best_meet, float('inf')) + dist_rev.get(best_meet, float('inf')) <= best_distance:
            break
        # Expand reverse step
        if pq_rev:
            d, node = heapq.heappop(pq_rev)
            tracker.increment_priority_queue_ops()
            if node not in visited_rev:
                visited_rev.add(node)
                tracker.record_reverse_node(node)
                tracker.increment_nodes_explored()
                nodes_explored += 1
                for nb in graph[node]['neighbors']:
                    if nb['node'] not in visited_rev:
                        relax(node, nb, dist_rev, dist_fwd, prev_rev, pq_rev)
        if best_meet is not None and dist_fwd.get(best_meet, float('inf')) + dist_rev.get(best_meet, float('inf')) <= best_distance:
            break
        if best_meet is not None:
            tracker.meeting_node = best_meet
            # termination condition already evaluated below

    tracker.stop_timing()

    if best_meet is None:
        return [], nodes_explored, tracker

    # Reconstruct forward path start -> best_meet
    f_path = []
    cur = best_meet
    while cur in prev_fwd:
        f_path.append(cur)
        cur = prev_fwd[cur]
    f_path.append(start_node)
    f_path.reverse()

    # Reconstruct reverse path best_meet -> end
    r_path = []
    cur = best_meet
    while cur in prev_rev:
        cur = prev_rev[cur]
        r_path.append(cur)
    # Combine
    full_path = f_path + r_path
    return full_path, nodes_explored, tracker
