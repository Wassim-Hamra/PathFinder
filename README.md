<p align="center">
  <img src="static/icons/favicon.svg" alt="PathFinder Logo" width="120" height="120" />
</p>
<h1 align="center">PathFinder – Real Street Route Visualization & Algorithm Explorer</h1>
<p align="center">
  An interactive Flask web application to explore and compare shortest-path algorithms (Dijkstra, A*, Bidirectional Dijkstra) on real-world street data. It fetches actual drivable routes via the public **OSRM API**, then derives a simplified graph model to highlight algorithmic behavior, performance, and complexity in a simplified manner.
</p>

---

## 🛠️ Technologies Used
- **Python** – Core backend language
- **Flask** – Backend API and server
- **Leaflet.js** – Interactive map rendering (Google Maps alternative due to API key constraints)
- **JavaScript** – Frontend logic and UI interactivity
- **OSRM API** – External service for real-world routing data
- **HTML & CSS** – UI structure and styling
- **NumPy** – Numeric operations for graph and metrics
- **Canvas API** – For frontend charts and gauges

---
## ✨ Key Features
| Category | Highlights |
|----------|------------|
| Map Interaction | Click to set Start (S) and End (E) points; auto-clears on new selection |
| Algorithms | Dijkstra, A*, Bidirectional Dijkstra, and 3-way comparison mode |
| Real Streets | Uses OSRM routing for street-conforming geometry |
| Graph Abstraction | Samples polyline → builds synthetic weighted graph with controlled shortcuts |
| Performance Metrics | Nodes explored, edges relaxed, heuristic calls, PQ ops, execution time |
| Bidirectional Insight | Forward + reverse frontier tracking + meeting node capture |
| Visual Analytics | Trend spark-line & per‑algorithm radial gauges (recent runs) |
| Animation | Progressive polyline drawing + multi-route comparison overlays |

---
## 🧬 Architecture Overview
```
+-----------------------------+
| Browser (Leaflet + UI)      |
|  - Click events             |
|  - Markers & animations     |
|  - Canvas trend + gauges    |
+---------------+-------------+
                | AJAX (JSON)
                v
+-----------------------------+
| Flask Backend (app.py)      |
|  /api/find-route            |
|   - Dispatch by algorithm   |
|   - OSRM request            |
|   - Graph construction      |
|   - Algorithm run + metrics |
+---------------+-------------+
                |
                v
+-----------------------------+
| Algorithm Layer (algorithms/)|
|  dijkstra.py / astar.py      |
|  bidirectional.py            |
|  performance_tracker.py      |
+-----------------------------+
                |
                v
+-----------------------------+
| External Service (OSRM)     |
|  Real-world route geometry  |
+-----------------------------+
```

---
## 🗺️ Real Route → Educational Graph
1. **OSRM Call:** `/route/v1/driving/LON,LAT;LON,LAT` returns a GeoJSON polyline of the *actual* drivable path.
2. **Polyline Sampling:** The dense coordinate list is down-sampled (capped ~120 nodes) to create stable node indices.
3. **Base Edges:** Consecutive sampled points form the primary path chain.
4. **Synthetic Shortcuts (Differentiation Layer):**
   - Dijkstra: infrequent, *penalized* skips (discourages shortcuts, more exploration).
   - A*: more frequent, lower-penalty forward skips (heuristic benefits).
   - Bidirectional: moderate skip frequency distinct from both to diversify frontier shape.
5. **Algorithm-specific behavior emerges** despite stemming from a single real-world path.

> This hybrid approach preserves *geographic realism* while enabling *algorithmic contrast* that would be subtle on a strict single-chain path.

---
## 🧠 Algorithms Implemented
### 1. Dijkstra’s Algorithm
Classic uniform-cost search using a priority queue (min-heap) keyed by cumulative distance.

**Pseudo-code:**
```text
function dijkstra(graph, start, goal):
    dist = {v: +inf}
    dist[start] = 0
    prev = {}
    pq = minHeap((0, start))
    while pq not empty:
        (d,u) = extract-min(pq)
        if u == goal: break
        for (v,w) in neighbors(u):
            alt = d + w
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                decrease-key / push (alt, v)
    return reconstruct_path(prev, goal)
```
**Key Metrics Tracked:** edges_relaxed, priority_queue_operations, nodes_explored.

### 2. A* Search
Extends Dijkstra with a heuristic `h(n)` (straight-line / haversine distance to goal). Prioritizes promising nodes earlier.

**Priority Key:** `f(n) = g(n) + h(n)`

**Pseudo-code:**
```text
function a_star(graph, start, goal):
    g = {v: +inf}; g[start] = 0
    f = {v: +inf}; f[start] = h(start)
    prev = {}
    open = minHeap((f[start], start))
    while open not empty:
        (fx, u) = extract-min(open)
        if u == goal: break
        for (v,w) in neighbors(u):
            tentative = g[u] + w
            if tentative < g[v]:
                g[v] = tentative
                f[v] = tentative + h(v)
                prev[v] = u
                push/update (f[v], v)
    return reconstruct_path(prev, goal)
```
**Extra Metric:** heuristic_calls.

### 3. Bidirectional Dijkstra
Simultaneously searches forward from start and backward from goal; stops when frontiers meet. Significantly reduces search space on large graphs.

**Meeting Criterion:** extraction of a node present in both visited sets or PQ top distances crossing.

**Pseudo-code (simplified):**
```text
function bidir_dijkstra(graph, start, goal):
    distF[start] = 0; distR[goal] = 0
    pqF = minHeap((0,start)); pqR = minHeap((0,goal))
    meet = None; best = +inf
    while pqF and pqR:
        expand forward step
        update best/meet if node visited by reverse
        expand reverse step
        update best/meet if node visited by forward
        if best <= min(top(pqF).d + top(pqR).d): break
    return build_meeting_path(meet, parentsF, parentsR)
```
**Added Metrics:** forward_nodes, reverse_nodes, meeting_node (post-processed into geographic coordinate for animation).

---
## ⏱️ Performance & Complexity Tracking
`performance_tracker.py` gathers granular counters:
| Metric | Meaning | Algorithms |
|--------|---------|------------|
| nodes_explored | Unique nodes dequeued / expanded | All |
| edges_relaxed | Successful distance improvements | Dijkstra / BiDir |
| heuristic_calls | Number of heuristic evaluations | A* |
| priority_queue_operations | Push + decrease-key approximations | All |
| memory_peak_usage | Peak size of active frontier sets | All |

### Complexity (Theoretical)
| Algorithm | Time (Typical) | Space | Notes |
|-----------|----------------|-------|-------|
| Dijkstra | O((V+E) log V) | O(V) | Binary heap variant |
| A* | O(b^d) worst; often << Dijkstra | O(V) | Depends on heuristic admissibility |
| Bidirectional Dijkstra | ~2·O((V+E) log V) but smaller explored set | O(V) | Early meeting dramatically shrinks search |

### Efficiency Ratio
Computed as: `(baseline_nodes_explored / algorithm_nodes_explored) * 100` (baseline = first run or internal reference) to portray relative pruning power.

---
## 🔍 Data Flow (Request → Visualization)
1. User clicks start & end → stored in `leaflet_map.js`.
2. POST `/api/find-route` with JSON:
```json
{
  "start": [lat, lng],
  "end": [lat, lng],
  "algorithm": "astar" | "dijkstra" | "bidirectional" | "compare"
}
```
3. Backend:
   - Calls OSRM
   - Samples & builds synthetic graph
   - Runs selected (or all) algorithms
   - Assembles metrics + path coordinates
4. Response (single algorithm example):
```json
{
  "algorithm": "astar",
  "coordinates": [[lat, lng], ...],
  "total_distance": 4.12,
  "duration_minutes": 9.3,
  "execution_time": 12.47,
  "nodes_explored": 57,
  "performance_analysis": {
    "complexity_analysis": {"nodes_explored":57, "execution_time_ms":12.47, "efficiency_ratio":91.2},
    "detailed_metrics": {"heuristic_calls":71, "priority_queue_operations":89}
  }
}
```
5. Frontend animates polyline, updates gauges, trend chart, legend.

---
## 🎨 Frontend Visualization Details
| Element | Purpose |
|---------|---------|
| Progressive Polyline | Simulates algorithm path reveal |
| Bidirectional Animation | (Forward + reverse segments converge) |
| Comparison Mode | Distinct dash patterns + colors |
| Trend Chart (Canvas) | Last N (≤3) node exploration history per algorithm |
| Radial Gauges | Current metric magnitude vs dynamic max |



---
## 🚀 Local Development
```bash
# 1. Create virtual env (optional)
python -m venv .venv
source .venv/bin/activate  # (Windows: .venv\Scripts\activate)

# 2. Install deps
pip install -r requirements.txt

# 3. Run dev server
export FLASK_DEBUG=1  # (Windows PowerShell: $Env:FLASK_DEBUG=1)
python app.py

# 4. Open
http://localhost:5000
```

---
## 🛠️ Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| No path returned | OSRM transient issue | Retry; choose nearby street nodes |
| All algorithms similar | Short route | choose longer route |

