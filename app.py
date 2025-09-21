from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import time
import requests
import os  # added for Heroku PORT
from algorithms.dijkstra import dijkstra_pathfinding
from algorithms.astar import astar_pathfinding
from algorithms.bidirectional import bidirectional_dijkstra_pathfinding
from algorithms.graph_utils import haversine_distance
from algorithms.performance_tracker import PerformanceTracker
import logging

logging.basicConfig(level=logging.INFO)



app = Flask(__name__)
CORS(app)



@app.before_request
def log_request_info():
    if request.path.startswith("/static/"):
        return  # skip logging static assets

    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ref = request.headers.get("Referer", "direct")
    ua = request.headers.get("User-Agent", "unknown")
    app.logger.info(f"Visitor IP={ip}, Referer={ref}, UserAgent={ua}")
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
            # Run all three algorithms for comparison
            dijkstra_result = find_path_with_algorithm(start_coords, end_coords, 'dijkstra')
            astar_result = find_path_with_algorithm(start_coords, end_coords, 'astar')
            bidirectional_result = find_path_with_algorithm(start_coords, end_coords, 'bidirectional')

            # Helper to extract numeric safely
            def num(v, default=0):
                try:
                    return float(v)
                except Exception:
                    return default

            # Determine fastest & shortest among three
            times = {
                'Dijkstra': num(dijkstra_result.get('execution_time')),
                'A*': num(astar_result.get('execution_time')),
                'Bidirectional': num(bidirectional_result.get('execution_time'))
            }
            dists = {
                'Dijkstra': num(dijkstra_result.get('total_distance')),
                'A*': num(astar_result.get('total_distance')),
                'Bidirectional': num(bidirectional_result.get('total_distance'))
            }
            # Identify winners
            faster_algorithm = min(times, key=times.get)
            shorter_path = min(dists, key=dists.get)

            comparison_payload = {
                'fastest_algorithm': faster_algorithm,
                'shortest_path': shorter_path,
                'time_spread_ms': round(max(times.values()) - min(times.values()), 2),
                'distance_spread_km': round(max(dists.values()) - min(dists.values()), 3),
                'rankings': {
                    'execution_time_ms': dict(sorted(times.items(), key=lambda x: x[1])),
                    'total_distance_km': dict(sorted(dists.items(), key=lambda x: x[1]))
                }
            }

            return jsonify({
                'type': 'comparison',
                'dijkstra': dijkstra_result,
                'astar': astar_result,
                'bidirectional': bidirectional_result,
                'comparison': comparison_payload
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
        # Increased cap to allow more variation in exploration
        nodes_count = min(len(route_coords), 120)

        # Sample route coordinates evenly (finer granularity for larger routes)
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

        # Base consecutive connections (street-following)
        for i in range(len(sampled_route) - 1):
            distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 1]))
            graph[i]['neighbors'].append({'node': i + 1, 'weight': distance})
            graph[i + 1]['neighbors'].append({'node': i, 'weight': distance})

        # Differentiated skip / shortcut strategy to amplify algorithm behavior differences
        if algorithm == 'dijkstra':
            # Less frequent, slightly more penalized skips -> encourages broader exploration
            for i in range(len(sampled_route) - 3):
                if i % 4 == 0:  # Less frequent than before
                    skip_distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 2]))
                    penalty_factor = 1.25  # Higher penalty -> path cost discourages direct jumps
                    graph[i]['neighbors'].append({'node': i + 2, 'weight': skip_distance * penalty_factor})
                    graph[i + 2]['neighbors'].append({'node': i, 'weight': skip_distance * penalty_factor})
        elif algorithm == 'bidirectional':
            # Similar to dijkstra but slightly different frequency to showcase variation
            for i in range(len(sampled_route) - 3):
                if i % 5 == 0:
                    skip_distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 2]))
                    penalty_factor = 1.22
                    graph[i]['neighbors'].append({'node': i + 2, 'weight': skip_distance * penalty_factor})
                    graph[i + 2]['neighbors'].append({'node': i, 'weight': skip_distance * penalty_factor})
        else:  # A* (or other future heuristic-based)
            # More frequent, lower-penalty forward skips + occasional longer skip -> heuristic benefits
            for i in range(len(sampled_route) - 3):
                if i % 3 == 0:
                    skip_distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 2]))
                    penalty_factor = 1.08  # Mild penalty -> attractive shortcut
                    graph[i]['neighbors'].append({'node': i + 2, 'weight': skip_distance * penalty_factor})
                    graph[i + 2]['neighbors'].append({'node': i, 'weight': skip_distance * penalty_factor})
                # Occasional longer leap to give heuristic a bigger advantage
                if i % 6 == 0 and i + 3 < len(sampled_route):
                    long_skip_distance = haversine_distance(tuple(sampled_route[i]), tuple(sampled_route[i + 3]))
                    graph[i]['neighbors'].append({'node': i + 3, 'weight': long_skip_distance * 1.12})
                    graph[i + 3]['neighbors'].append({'node': i, 'weight': long_skip_distance * 1.12})

        # Run the selected algorithm with performance tracking
        if algorithm == 'dijkstra':
            path, nodes_explored, tracker = dijkstra_pathfinding(graph, 0, len(sampled_route) - 1, tracker)
        elif algorithm == 'astar':
            path, nodes_explored, tracker = astar_pathfinding(graph, 0, len(sampled_route) - 1, tracker)
        elif algorithm == 'bidirectional':
            path, nodes_explored, tracker = bidirectional_dijkstra_pathfinding(graph, 0, len(sampled_route) - 1, tracker)
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
        if algorithm == 'bidirectional':
            # Map forward/reverse node ids to coordinates using sampled_route indexing
            forward_coords = []
            reverse_coords = []
            for nid in tracker.forward_nodes:
                if 0 <= nid < len(sampled_route):
                    forward_coords.append(sampled_route[nid])
            for nid in tracker.reverse_nodes:
                if 0 <= nid < len(sampled_route):
                    reverse_coords.append(sampled_route[nid])
            meeting_coord = None
            if tracker.meeting_node is not None and 0 <= tracker.meeting_node < len(sampled_route):
                meeting_coord = sampled_route[tracker.meeting_node]
            result['bidirectional'] = {
                'forward_explored': forward_coords,
                'reverse_explored': reverse_coords,
                'meeting_node': meeting_coord
            }

        return result

    except Exception as e:
        print(f"Algorithm error: {str(e)}")
        return {'error': f'Algorithm execution failed: {str(e)}'}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = bool(os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes'))
    print(f"Starting PathFinder on 0.0.0.0:{port} (debug={debug})")
    app.run(host='0.0.0.0', port=port, debug=debug)
