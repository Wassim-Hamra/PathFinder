from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json
import time
import math

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analytics')
def analytics():
    return render_template('analytics.html')

@app.route('/api/find-route', methods=['POST'])
def find_route():
    try:
        data = request.get_json()
        start_coords = data.get('start')  # [lat, lng]
        end_coords = data.get('end')      # [lat, lng]
        algorithm = data.get('algorithm', 'fastest')

        if not all([start_coords, end_coords]):
            return jsonify({'error': 'Start and end coordinates are required'}), 400

        # Return coordinates for client-side routing
        # We'll let Leaflet Routing Machine handle the actual street routing on the frontend
        return jsonify({
            'start': start_coords,
            'end': end_coords,
            'algorithm': algorithm,
            'use_client_routing': True,
            'execution_time': 1.0
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
