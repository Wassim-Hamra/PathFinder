"""
Algorithm Complexity Analysis Script
Provides detailed insights into Dijkstra's and A* algorithm performance
"""

from algorithms.performance_tracker import PerformanceTracker
from algorithms.dijkstra import dijkstra_pathfinding
from algorithms.astar import astar_pathfinding
from algorithms.graph_utils import haversine_distance
import random
import math
import json

def generate_test_graph(size: int) -> dict:
    """Generate a test graph for complexity analysis"""
    graph = {}

    # Create nodes with random coordinates
    for i in range(size):
        lat = 40.7128 + random.uniform(-0.1, 0.1)  # Around NYC
        lng = -74.0060 + random.uniform(-0.1, 0.1)
        graph[i] = {
            'coordinates': [lat, lng],
            'neighbors': []
        }

    # Connect nodes (create a connected graph)
    for i in range(size):
        # Connect to next node (linear path)
        if i < size - 1:
            distance = haversine_distance(graph[i]['coordinates'], graph[i+1]['coordinates'])
            graph[i]['neighbors'].append({'node': i+1, 'weight': distance})
            graph[i+1]['neighbors'].append({'node': i, 'weight': distance})

        # Add some random connections for complexity
        num_connections = random.randint(1, min(4, size-1))
        for _ in range(num_connections):
            neighbor = random.randint(0, size-1)
            if neighbor != i:
                distance = haversine_distance(graph[i]['coordinates'], graph[neighbor]['coordinates'])
                # Avoid duplicate connections
                if not any(n['node'] == neighbor for n in graph[i]['neighbors']):
                    graph[i]['neighbors'].append({'node': neighbor, 'weight': distance})
                    graph[neighbor]['neighbors'].append({'node': i, 'weight': distance})

    return graph

def run_complexity_analysis():
    """Run comprehensive complexity analysis"""
    print("🔍 Algorithm Complexity Analysis")
    print("=" * 50)

    # Test different graph sizes
    test_sizes = [10, 20, 30, 50]
    results = {}

    for size in test_sizes:
        print(f"\n📊 Testing graph with {size} nodes...")

        # Generate test graph
        graph = generate_test_graph(size)
        start_node = 0
        end_node = size - 1

        # Test Dijkstra
        dijkstra_tracker = PerformanceTracker()
        path_d, nodes_d, dijkstra_tracker = dijkstra_pathfinding(graph, start_node, end_node, dijkstra_tracker)
        dijkstra_analysis = dijkstra_tracker.get_time_complexity_analysis()

        # Test A*
        astar_tracker = PerformanceTracker()
        path_a, nodes_a, astar_tracker = astar_pathfinding(graph, start_node, end_node, astar_tracker)
        astar_analysis = astar_tracker.get_time_complexity_analysis()

        results[size] = {
            'dijkstra': dijkstra_analysis,
            'astar': astar_analysis,
            'comparison': dijkstra_tracker.get_comparison_analysis(astar_tracker)
        }

        # Print immediate results - fix the key name
        print(f"  Dijkstra: {dijkstra_analysis['execution_time_ms']:.2f}ms, {dijkstra_tracker.nodes_explored} nodes")
        print(f"  A*:       {astar_analysis['execution_time_ms']:.2f}ms, {astar_tracker.nodes_explored} nodes")
        print(f"  Efficiency: A* explored {astar_analysis['efficiency_ratio']:.1f}% vs Dijkstra {dijkstra_analysis['efficiency_ratio']:.1f}%")

    return results

def print_complexity_insights(results):
    """Print detailed complexity insights"""
    print("\n" + "=" * 50)
    print("🧠 ALGORITHM COMPLEXITY INSIGHTS")
    print("=" * 50)

    print("\n📈 TIME COMPLEXITY ANALYSIS:")
    print("-" * 30)

    print("\n🔵 DIJKSTRA'S ALGORITHM:")
    print("   • Time Complexity: O((V + E) log V)")
    print("   • Space Complexity: O(V)")
    print("   • Characteristics:")
    print("     - Guarantees shortest path")
    print("     - Explores nodes in order of distance from start")
    print("     - Uses priority queue for efficient node selection")
    print("     - Performance depends on graph density")

    print("\n🔴 A* ALGORITHM:")
    print("   • Time Complexity: O(b^d) where b=branching factor, d=depth")
    print("   • Space Complexity: O(V)")
    print("   • Characteristics:")
    print("     - Uses heuristic to guide search toward goal")
    print("     - Often faster than Dijkstra with good heuristic")
    print("     - Performance depends on heuristic quality")
    print("     - Best-first search with Manhattan/Euclidean distance")

    print("\n📊 PERFORMANCE COMPARISON:")
    print("-" * 30)

    for size, data in results.items():
        dijkstra = data['dijkstra']
        astar = data['astar']
        comparison = data['comparison']

        print(f"\n📐 Graph Size: {size} nodes")
        print(f"   Dijkstra: {dijkstra['execution_time_ms']:.2f}ms | {dijkstra['nodes_explored']} nodes | {dijkstra['efficiency_ratio']:.1f}% efficiency")
        print(f"   A*:       {astar['execution_time_ms']:.2f}ms | {astar['nodes_explored']} nodes | {astar['efficiency_ratio']:.1f}% efficiency")

        faster_alg = comparison['time_comparison']['faster_algorithm']
        speedup = comparison['time_comparison']['speedup_factor']
        print(f"   🏆 Winner: {faster_alg} ({speedup:.1f}x faster)")

        more_efficient = comparison['exploration_comparison']['more_efficient']
        efficiency_improvement = comparison['exploration_comparison']['efficiency_improvement']
        print(f"   🎯 More Efficient: {more_efficient} ({efficiency_improvement:.1f}% fewer nodes)")

def analyze_scaling_behavior(results):
    """Analyze how algorithms scale with graph size"""
    print("\n" + "=" * 50)
    print("📈 SCALING BEHAVIOR ANALYSIS")
    print("=" * 50)

    sizes = list(results.keys())
    dijkstra_times = [results[size]['dijkstra']['execution_time_ms'] for size in sizes]
    astar_times = [results[size]['astar']['execution_time_ms'] for size in sizes]

    print("\n🔍 Time Complexity Scaling:")
    print("-" * 25)

    for i, size in enumerate(sizes):
        if i > 0:
            prev_size = sizes[i-1]
            size_ratio = size / prev_size

            dijkstra_time_ratio = dijkstra_times[i] / dijkstra_times[i-1] if dijkstra_times[i-1] > 0 else 1
            astar_time_ratio = astar_times[i] / astar_times[i-1] if astar_times[i-1] > 0 else 1

            expected_ratio = size_ratio * math.log2(size) / math.log2(prev_size)  # O(n log n) expectation

            print(f"\n📊 {prev_size} → {size} nodes ({size_ratio:.1f}x larger):")
            print(f"   Expected scaling (O(n log n)): {expected_ratio:.2f}x")
            print(f"   Dijkstra actual scaling: {dijkstra_time_ratio:.2f}x")
            print(f"   A* actual scaling: {astar_time_ratio:.2f}x")

            if dijkstra_time_ratio < expected_ratio:
                print("   ✅ Dijkstra scales better than theoretical worst case")
            else:
                print("   ⚠️ Dijkstra scaling matches/exceeds theoretical complexity")

            if astar_time_ratio < dijkstra_time_ratio:
                print("   🎯 A* shows superior scaling due to heuristic guidance")
            else:
                print("   📍 A* scaling similar to Dijkstra (heuristic less effective)")

def generate_performance_report():
    """Generate a comprehensive performance report"""
    print("\n🚀 RUNNING COMPREHENSIVE ALGORITHM ANALYSIS...")
    print("This will test both algorithms on various graph sizes")
    print("to analyze their time complexity behavior.\n")

    # Run the analysis
    results = run_complexity_analysis()

    # Print insights
    print_complexity_insights(results)

    # Analyze scaling
    analyze_scaling_behavior(results)

    print("\n" + "=" * 50)
    print("🎯 KEY TAKEAWAYS")
    print("=" * 50)

    print("\n💡 Time Complexity Insights:")
    print("   • Dijkstra: O((V + E) log V) - consistent, predictable performance")
    print("   • A*: O(b^d) - highly dependent on heuristic quality")
    print("   • A* typically faster due to goal-directed search")
    print("   • Dijkstra explores more nodes but guarantees optimality")

    print("\n💡 Space Complexity Insights:")
    print("   • Both algorithms: O(V) space complexity")
    print("   • Dijkstra: distances, previous, visited, priority_queue")
    print("   • A*: g_score, f_score, came_from, open_set")
    print("   • Memory usage scales linearly with graph size")

    print("\n💡 Practical Recommendations:")
    print("   • Use A* for single shortest-path queries (GPS navigation)")
    print("   • Use Dijkstra for all-pairs shortest paths")
    print("   • A* excels when goal location is known")
    print("   • Consider graph preprocessing for repeated queries")

    return results

if __name__ == "__main__":
    generate_performance_report()
