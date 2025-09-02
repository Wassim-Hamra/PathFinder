import time

class PerformanceTracker:
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.nodes_explored = 0

    def start_timing(self):
        self.start_time = time.time()

    def stop_timing(self):
        self.end_time = time.time()

    def get_execution_time(self):
        if self.start_time is None:
            return 0
        end = self.end_time if self.end_time else time.time()
        return (end - self.start_time) * 1000  # Return in milliseconds

    def increment_nodes_explored(self):
        self.nodes_explored += 1
