import random
import math

def generate_random_graph(width, height, obstacle_density=0.15):
    """
    Generate a random grid-based graph with obstacles
    """
    nodes = []
    edges = []
    obstacles = []

    # Create nodes
    node_id = 0
    for y in range(height):
        for x in range(width):
            # Randomly place obstacles
            is_obstacle = random.random() < obstacle_density

            if is_obstacle:
                obstacles.append([x, y])
            else:
                nodes.append({
                    'id': node_id,
                    'x': x,
                    'y': y,
                    'type': 'normal'
                })
                node_id += 1

    # Create edges between adjacent non-obstacle nodes
    node_positions = {(node['x'], node['y']): node['id'] for node in nodes}

    for node in nodes:
        x, y = node['x'], node['y']

        # Check 4-directional connectivity
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]

        for dx, dy in directions:
            new_x, new_y = x + dx, y + dy

            # Check bounds and if target is not an obstacle
            if (0 <= new_x < width and 0 <= new_y < height and
                (new_x, new_y) in node_positions):

                target_id = node_positions[(new_x, new_y)]

                # Calculate distance (can be customized)
                distance = 1.0
                time_cost = random.uniform(0.8, 1.2)  # Random time variation

                edges.append({
                    'source': node['id'],
                    'target': target_id,
                    'weight': distance,
                    'distance': distance,
                    'time': time_cost
                })

    return {
        'nodes': nodes,
        'edges': edges,
        'obstacles': obstacles,
        'bounds': {
            'minX': 0,
            'minY': 0,
            'maxX': width - 1,
            'maxY': height - 1
        },
        'metadata': {
            'width': width,
            'height': height,
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'obstacle_count': len(obstacles)
        }
    }
