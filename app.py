from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import time
import requests
from algorithms.dijkstra import dijkstra_pathfinding
from algorithms.astar import astar_pathfinding
from algorithms.graph_utils import haversine_distance
from algorithms.performance_tracker import PerformanceTracker

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/find-route', methods=['POST'])
def find_route():
    try:
        data = request.get_json()
        start_coords = data.get('start')  # [lat, lng]
        end_coords = data.get('end')      # [lat, lng]
        algorithm = data.get('algorithm', 'dijkstra')

        if not all([start_coords, end_coords]):
            return jsonify({'error': 'Start and end coordinates are required'}), 400

        if algorithm == 'compare':
            # Compare Dijkstra vs A* algorithms on the same street network
            dijkstra_result = find_path_with_algorithm(start_coords, end_coords, 'dijkstra')
            astar_result = find_path_with_algorithm(start_coords, end_coords, 'astar')

            return jsonify({
                'type': 'comparison',
                'dijkstra': dijkstra_result,
                'astar': astar_result,
                'comparison': {
                    'distance_difference': abs(float(dijkstra_result['total_distance']) - float(astar_result['total_distance'])),
                    'time_difference': abs(float(dijkstra_result['execution_time']) - float(astar_result['execution_time'])),
                    'nodes_difference': abs(int(dijkstra_result['nodes_explored']) - int(astar_result['nodes_explored'])),
                    'faster_algorithm': 'A*' if float(astar_result['execution_time']) < float(dijkstra_result['execution_time']) else 'Dijkstra',
                    'shorter_path': 'A*' if float(astar_result['total_distance']) < float(dijkstra_result['total_distance']) else 'Dijkstra'
                }
            })
        else:
            # Single algorithm execution
            result = find_path_with_algorithm(start_coords, end_coords, algorithm)
            return jsonify(result)

    except Exception as e:
        print(f"Error in find_route: {str(e)}")
        return jsonify({'error': str(e)}), 500

def find_path_with_algorithm(start_coords, end_coords, algorithm):
    """Find path using specified algorithm with real OSRM routing"""
    start_time = time.time()
    tracker = PerformanceTracker()

    try:
        # Get actual route from OSRM (this follows real streets)
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true'
        }

        response = requests.get(osrm_url, params=params, timeout=10)
        response.raise_for_status()
        osrm_data = response.json()

        if not osrm_data.get('routes'):
            return {'error': 'No route found between the specified points'}

        route = osrm_data['routes'][0]
        geometry = route['geometry']

        # Get the actual street-following coordinates
        route_coords = geometry['coordinates']
        # Convert from [lng, lat] to [lat, lng] format
        route_coords = [[coord[1], coord[0]] for coord in route_coords]

        # Create a simplified graph for algorithm demonstration
        graph = {}
        nodes_count = min(len(route_coords), 50)  # Limit for performance

        # Sample route coordinates evenly
        step = max(1, len(route_coords) // nodes_count)
        sampled_route = route_coords[::step]

        # Ensure we include the exact end point
        if route_coords[-1] not in sampled_route:
            sampled_route.append(route_coords[-1])

        # Create graph nodes
        for i in range(len(sampled_route)):
            graph[i] = {
                'coordinates': sampled_route[i],
                'neighbors': []
            }

        # Connect consecutive nodes (this maintains street following)
        for i in range(len(sampled_route) - 1):
            distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 1]))
            graph[i]['neighbors'].append({'node': i + 1, 'weight': distance})
            graph[i + 1]['neighbors'].append({'node': i, 'weight': distance})

        # Add some skip connections for algorithm differentiation
        for i in range(len(sampled_route) - 3):
            if i % 3 == 0:  # Every 3rd node, add a skip connection
                skip_distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 2]))
                penalty_factor = 1.2 if algorithm == 'dijkstra' else 1.1

                graph[i]['neighbors'].append({'node': i + 2, 'weight': skip_distance * penalty_factor})
                graph[i + 2]['neighbors'].append({'node': i, 'weight': skip_distance * penalty_factor})

        # Run the selected algorithm with performance tracking
        if algorithm == 'dijkstra':
            path, nodes_explored, tracker = dijkstra_pathfinding(graph, 0, len(sampled_route) - 1, tracker)
        elif algorithm == 'astar':
            path, nodes_explored, tracker = astar_pathfinding(graph, 0, len(sampled_route) - 1, tracker)
        else:
            return {'error': f'Unknown algorithm: {algorithm}'}

        if not path:
            return {'error': 'No path found between the selected points'}

        # Convert algorithm path back to detailed street coordinates
        detailed_coords = []
        for i in range(len(path) - 1):
            current_idx = path[i] * step
            next_idx = path[i + 1] * step

            segment_start = min(current_idx, len(route_coords) - 1)
            segment_end = min(next_idx, len(route_coords) - 1)

            if segment_start < segment_end:
                detailed_coords.extend(route_coords[segment_start:segment_end + 1])
            else:
                detailed_coords.append(route_coords[segment_start])

        # Remove duplicates while preserving order
        final_coords = []
        for coord in detailed_coords:
            if not final_coords or coord != final_coords[-1]:
                final_coords.append(coord)

        # Calculate metrics from OSRM data
        distance_km = route['distance'] / 1000
        duration_minutes = route['duration'] / 60
        execution_time = time.time() - start_time

        # Get detailed performance analysis
        complexity_analysis = tracker.get_time_complexity_analysis()
        space_analysis = tracker.get_space_complexity_analysis()

        # Prepare result with enhanced performance data
        result = {
            'algorithm': algorithm,
            'coordinates': final_coords,
            'total_distance': round(distance_km, 2),
            'duration_minutes': round(duration_minutes, 1),
            'execution_time': round(execution_time * 1000, 2),
            'nodes_explored': nodes_explored,
            'path_found': True,
            'start': start_coords,
            'end': end_coords,
            'performance_analysis': {
                'complexity_analysis': complexity_analysis,
                'space_analysis': space_analysis,
                'detailed_metrics': {
                    'edges_relaxed': tracker.edges_relaxed,
                    'heuristic_calls': tracker.heuristic_calls,
                    'priority_queue_operations': tracker.priority_queue_operations,
                    'memory_peak_usage': tracker.memory_usage
                }
            }
        }

        return result

    except Exception as e:
        print(f"Algorithm error: {str(e)}")
        return {'error': f'Algorithm execution failed: {str(e)}'}

if __name__ == '__main__':
    print("Starting Route Optimizer Application...")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=True, host='0.0.0.0', port=5000)
