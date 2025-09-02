import time
import math
from typing import Dict, List, Tuple, Optional

class PerformanceTracker:
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.nodes_explored = 0
        self.edges_relaxed = 0  # For Dijkstra edge relaxation count
        self.heuristic_calls = 0  # For A* heuristic function calls
        self.priority_queue_operations = 0  # Push/pop operations
        self.memory_usage = 0  # Track data structures size
        self.algorithm_name = ""
        self.graph_size = 0  # Number of nodes in graph
        self.edge_count = 0  # Number of edges in graph

    def start_timing(self):
        """Start timing the algorithm execution"""
        self.start_time = time.time()

    def stop_timing(self):
        """Stop timing the algorithm execution"""
        self.end_time = time.time()

    def get_execution_time(self):
        """Get execution time in milliseconds"""
        if self.start_time is None:
            return 0
        end = self.end_time if self.end_time else time.time()
        return (end - self.start_time) * 1000  # Return in milliseconds

    def increment_nodes_explored(self):
        """Increment the count of nodes explored"""
        self.nodes_explored += 1

    def increment_edges_relaxed(self):
        """Increment the count of edges relaxed (Dijkstra)"""
        self.edges_relaxed += 1

    def increment_heuristic_calls(self):
        """Increment the count of heuristic function calls (A*)"""
        self.heuristic_calls += 1

    def increment_priority_queue_ops(self):
        """Increment priority queue operations count"""
        self.priority_queue_operations += 1

    def set_graph_metrics(self, nodes: int, edges: int):
        """Set graph size metrics"""
        self.graph_size = nodes
        self.edge_count = edges

    def set_algorithm_name(self, name: str):
        """Set the algorithm name for analysis"""
        self.algorithm_name = name

    def update_memory_usage(self, data_structure_size: int):
        """Update memory usage tracking"""
        self.memory_usage = max(self.memory_usage, data_structure_size)

    def get_time_complexity_analysis(self) -> Dict:
        """
        Analyze the time complexity based on the tracked metrics
        Returns detailed complexity analysis
        """
        V = self.graph_size  # Number of vertices/nodes
        E = self.edge_count  # Number of edges

        if self.algorithm_name.lower() == 'dijkstra':
            theoretical_complexity = f"O((V + E) log V) = O(({V} + {E}) log {V})"
            if V > 0:
                theoretical_ops = (V + E) * math.log2(V) if V > 1 else V + E
            else:
                theoretical_ops = 0

            # Dijkstra analysis
            analysis = {
                "algorithm": "Dijkstra's Algorithm",
                "theoretical_complexity": theoretical_complexity,
                "theoretical_operations": int(theoretical_ops),
                "nodes_explored": self.nodes_explored,  # Fixed key name
                "edges_relaxed": self.edges_relaxed,
                "priority_queue_operations": self.priority_queue_operations,
                "efficiency_ratio": (self.nodes_explored / V * 100) if V > 0 else 0,
                "complexity_factors": {
                    "vertices": V,
                    "edges": E,
                    "log_v": math.log2(V) if V > 1 else 1
                }
            }

        elif self.algorithm_name.lower() == 'astar' or self.algorithm_name.lower() == 'a*':
            # A* complexity depends on heuristic quality
            theoretical_complexity = f"O(b^d) where b=branching factor, d=depth"

            # Estimate branching factor from graph structure
            avg_branching = E / V if V > 0 else 0
            estimated_depth = math.log(V, avg_branching) if avg_branching > 1 and V > 1 else V

            analysis = {
                "algorithm": "A* Algorithm",
                "theoretical_complexity": theoretical_complexity,
                "estimated_branching_factor": round(avg_branching, 2),
                "estimated_solution_depth": int(estimated_depth),
                "nodes_explored": self.nodes_explored,
                "heuristic_calls": self.heuristic_calls,
                "priority_queue_operations": self.priority_queue_operations,
                "efficiency_ratio": (self.nodes_explored / V * 100) if V > 0 else 0,
                "heuristic_effectiveness": {
                    "calls_per_node": (self.heuristic_calls / self.nodes_explored) if self.nodes_explored > 0 else 0,
                    "guidance_quality": "Good" if self.nodes_explored < V * 0.5 else "Average" if self.nodes_explored < V * 0.8 else "Poor"
                }
            }
        else:
            analysis = {
                "algorithm": "Unknown Algorithm",
                "error": "Algorithm not recognized for complexity analysis"
            }

        # Common metrics for both algorithms
        analysis.update({
            "execution_time_ms": self.get_execution_time(),
            "graph_metrics": {
                "total_nodes": V,
                "total_edges": E,
                "graph_density": (2 * E) / (V * (V - 1)) if V > 1 else 0
            },
            "performance_insights": self._generate_performance_insights()
        })

        return analysis

    def get_space_complexity_analysis(self) -> Dict:
        """
        Analyze space complexity of the algorithms
        """
        V = self.graph_size

        if self.algorithm_name.lower() == 'dijkstra':
            return {
                "algorithm": "Dijkstra's Algorithm",
                "space_complexity": f"O(V) = O({V})",
                "data_structures": {
                    "distances_array": V,
                    "previous_array": V,
                    "visited_set": self.nodes_explored,
                    "priority_queue": f"O(V) worst case = {V}"
                },
                "total_memory_estimate": V * 3,  # Rough estimate
                "actual_peak_usage": self.memory_usage
            }
        elif self.algorithm_name.lower() == 'astar' or self.algorithm_name.lower() == 'a*':
            return {
                "algorithm": "A* Algorithm",
                "space_complexity": f"O(V) = O({V})",
                "data_structures": {
                    "g_score_array": V,
                    "f_score_array": V,
                    "came_from_array": V,
                    "open_set": f"O(V) worst case = {V}"
                },
                "total_memory_estimate": V * 4,  # Rough estimate
                "actual_peak_usage": self.memory_usage
            }

    def _generate_performance_insights(self) -> List[str]:
        """Generate human-readable performance insights"""
        insights = []
        V = self.graph_size
        exploration_ratio = (self.nodes_explored / V * 100) if V > 0 else 0

        # Efficiency insights
        if exploration_ratio < 30:
            insights.append("Excellent efficiency - explored less than 30% of the graph")
        elif exploration_ratio < 50:
            insights.append("Good efficiency - explored less than 50% of the graph")
        elif exploration_ratio < 80:
            insights.append("Moderate efficiency - explored most of the graph")
        else:
            insights.append("Low efficiency - explored nearly the entire graph")

        # Time complexity insights
        if self.algorithm_name.lower() == 'dijkstra':
            if self.edges_relaxed > 0:
                relaxation_ratio = self.edges_relaxed / self.edge_count if self.edge_count > 0 else 0
                if relaxation_ratio < 0.3:
                    insights.append("Dijkstra performed minimal edge relaxations - sparse exploration")
                else:
                    insights.append("Dijkstra performed extensive edge relaxations - thorough search")

        elif self.algorithm_name.lower() == 'astar' or self.algorithm_name.lower() == 'a*':
            if self.heuristic_calls > 0:
                heuristic_efficiency = self.heuristic_calls / self.nodes_explored if self.nodes_explored > 0 else 0
                if heuristic_efficiency > 2:
                    insights.append("A* heuristic guided search effectively towards the goal")
                else:
                    insights.append("A* heuristic provided moderate guidance")

        # Execution time insights
        exec_time = self.get_execution_time()
        if exec_time < 10:
            insights.append("Very fast execution - suitable for real-time applications")
        elif exec_time < 100:
            insights.append("Fast execution - good for interactive applications")
        elif exec_time < 1000:
            insights.append("Moderate execution time - acceptable for most use cases")
        else:
            insights.append("Slow execution - consider optimization for large datasets")

        return insights

    def get_comparison_analysis(self, other_tracker: 'PerformanceTracker') -> Dict:
        """
        Compare performance between two algorithm runs
        """
        self_time = self.get_execution_time()
        other_time = other_tracker.get_execution_time()

        return {
            "time_comparison": {
                f"{self.algorithm_name}_time_ms": self_time,
                f"{other_tracker.algorithm_name}_time_ms": other_time,
                "faster_algorithm": self.algorithm_name if self_time < other_time else other_tracker.algorithm_name,
                "time_difference_ms": abs(self_time - other_time),
                "speedup_factor": max(self_time, other_time) / min(self_time, other_time) if min(self_time, other_time) > 0 else 1
            },
            "exploration_comparison": {
                f"{self.algorithm_name}_nodes_explored": self.nodes_explored,
                f"{other_tracker.algorithm_name}_nodes_explored": other_tracker.nodes_explored,
                "more_efficient": self.algorithm_name if self.nodes_explored < other_tracker.nodes_explored else other_tracker.algorithm_name,
                "exploration_difference": abs(self.nodes_explored - other_tracker.nodes_explored),
                "efficiency_improvement": abs(self.nodes_explored - other_tracker.nodes_explored) / max(self.nodes_explored, other_tracker.nodes_explored) * 100
            },
            "algorithm_characteristics": {
                self.algorithm_name: {
                    "strengths": self._get_algorithm_strengths(),
                    "use_cases": self._get_algorithm_use_cases()
                },
                other_tracker.algorithm_name: {
                    "strengths": other_tracker._get_algorithm_strengths(),
                    "use_cases": other_tracker._get_algorithm_use_cases()
                }
            }
        }

    def _get_algorithm_strengths(self) -> List[str]:
        """Get algorithm-specific strengths"""
        if self.algorithm_name.lower() == 'dijkstra':
            return [
                "Guarantees shortest path",
                "Works with any non-negative edge weights",
                "Finds shortest paths to all nodes",
                "No heuristic required"
            ]
        elif self.algorithm_name.lower() == 'astar' or self.algorithm_name.lower() == 'a*':
            return [
                "Often faster than Dijkstra with good heuristic",
                "Goal-directed search",
                "Optimal with admissible heuristic",
                "Reduces search space significantly"
            ]
        return []

    def _get_algorithm_use_cases(self) -> List[str]:
        """Get algorithm-specific use cases"""
        if self.algorithm_name.lower() == 'dijkstra':
            return [
                "Finding shortest paths in road networks",
                "Network routing protocols",
                "Social network analysis",
                "When no good heuristic is available"
            ]
        elif self.algorithm_name.lower() == 'astar' or self.algorithm_name.lower() == 'a*':
            return [
                "GPS navigation systems",
                "Game AI pathfinding",
                "Robotics path planning",
                "When goal location is known"
            ]
        return []

    def reset(self):
        """Reset all tracking metrics"""
        self.start_time = None
        self.end_time = None
        self.nodes_explored = 0
        self.edges_relaxed = 0
        self.heuristic_calls = 0
        self.priority_queue_operations = 0
        self.memory_usage = 0
