import os
import time
from flask import Flask, jsonify
from flask_cors import CORS
from routes import api_bp
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
_rate_limits = {}


@app.before_request
def simple_rate_limit():
    from flask import request
    window_seconds = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))
    max_requests = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '180'))
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()
    now = time.time()
    bucket = [stamp for stamp in _rate_limits.get(client_ip, []) if now - stamp < window_seconds]
    if len(bucket) >= max_requests:
        return jsonify({'message': 'Too many requests. Please try again later.'}), 429
    bucket.append(now)
    _rate_limits[client_ip] = bucket

# Security: Restrict CORS to specific origins only
CORS(app,
     origins=[
         'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176',
         'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179', 'http://localhost:5180',
         'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175', 'http://127.0.0.1:5176',
         'http://127.0.0.1:5177', 'http://127.0.0.1:5178', 'http://127.0.0.1:5179', 'http://127.0.0.1:5180',
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True)


@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    if not app.debug:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Global error handler - prevents information disclosure
@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found.'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'message': 'Internal server error. Please try again later.'}), 500

app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    # Only enable debug mode in development
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(host='127.0.0.1', port=5000, debug=debug_mode)
