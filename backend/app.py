from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from models import db
from config import Config
import os
from datetime import datetime

# Import blueprints
from auth import auth_bp
from sessions import sessions_bp
from emotion_routes import emotion_bp
from realtime_routes import realtime_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    CORS(app, origins=["https://d0bf6c379064.ngrok-free.app"])

    # Initialize SocketIO with better configuration for remote connections
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

    # Create upload directory
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(sessions_bp, url_prefix='/api')
    app.register_blueprint(emotion_bp, url_prefix='/api')
    app.register_blueprint(realtime_bp, url_prefix='/api/realtime')

    # Initialize emotion detector
    try:
        from emotion_detector import init_emotion_detector
        model_path = app.config['MODEL_PATH']
        cascade_path = app.config['CASCADE_PATH']
        if os.path.exists(model_path) and os.path.exists(cascade_path):
            init_emotion_detector(model_path, cascade_path)
            print("✅ Emotion detector initialized successfully")
        else:
            print("⚠️ Warning: Model files not found. Emotion detection will not be available.")
    except Exception as e:
        print(f"❌ Error initializing emotion detector: {e}")

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization token is required'}), 401

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'message': 'Therapy Meet API is running',
            'version': '2.0.0'
        }), 200

    # Store active sessions and their states
    active_sessions = {}

    # SocketIO Events for real-time communication
    @socketio.on('connect')
    def on_connect():
        print(f"Client connected: {request.sid}")
        emit('connected', {'message': 'Connected to server'})

    @socketio.on('disconnect')
    def on_disconnect():
        print(f"Client disconnected: {request.sid}")

    @socketio.on('join_session')
    def on_join_session(data):
        session_code = data['session_code']
        user_role = data['user_role']
        username = data['username']

        join_room(session_code)

        # Initialize session state if not exists
        if session_code not in active_sessions:
            active_sessions[session_code] = {
                'participants': [],
                'current_question_index': 0,
                'is_analyzing': False,
                'analysis_data': None
            }

        # Add participant to session
        participant_info = {
            'username': username,
            'role': user_role,
            'sid': request.sid
        }

        # Remove existing participant with same username (reconnection)
        active_sessions[session_code]['participants'] = [
            p for p in active_sessions[session_code]['participants']
            if p['username'] != username
        ]
        active_sessions[session_code]['participants'].append(participant_info)

        emit('user_joined', {
            'username': username,
            'role': user_role,
            'message': f'{username} ({user_role}) se unió a la sesión',
            'participants_count': len(active_sessions[session_code]['participants'])
        }, room=session_code)

        # Send current session state to new participant
        emit('session_state_update', {
            'current_question_index': active_sessions[session_code]['current_question_index'],
            'is_analyzing': active_sessions[session_code]['is_analyzing'],
            'participants_count': len(active_sessions[session_code]['participants'])
        }, room=request.sid)

        print(f"User {username} ({user_role}) joined session {session_code}")

    @socketio.on('leave_session')
    def on_leave_session(data):
        session_code = data['session_code']
        username = data['username']

        leave_room(session_code)

        if session_code in active_sessions:
            # Remove participant from session
            active_sessions[session_code]['participants'] = [
                p for p in active_sessions[session_code]['participants']
                if p['username'] != username
            ]

        emit('user_left', {
            'username': username,
            'message': f'{username} salió de la sesión'
        }, room=session_code)

    @socketio.on('therapist_question')
    def on_therapist_question(data):
        session_code = data['session_code']
        question_text = data['question_text']
        question_id = data['question_id']

        emit('new_question', {
            'question_text': question_text,
            'question_id': question_id,
            'timestamp': data.get('timestamp')
        }, room=session_code)

    @socketio.on('update_question_index')
    def on_update_question_index(data):
        session_code = data['session_code']
        question_index = data['question_index']

        if session_code in active_sessions:
            active_sessions[session_code]['current_question_index'] = question_index

            emit('question_index_updated', {
                'question_index': question_index
            }, room=session_code)

    @socketio.on('start_emotion_analysis')
    def on_start_emotion_analysis(data):
        session_code = data['session_code']
        question_id = data['question_id']
        duration = data['duration']
        if session_code in active_sessions:
            active_sessions[session_code]['is_analyzing'] = True
            active_sessions[session_code]['analysis_data'] = {
                'question_id': question_id,
                'duration': duration,
                'start_time': datetime.now().isoformat(),
                'emotions_detected': []
            }

        emit('emotion_analysis_started', {
            'question_id': question_id,
            'duration': duration,
            'message': 'Iniciando análisis emocional...'
        }, room=session_code)

    @socketio.on('stop_emotion_analysis')
    def on_stop_emotion_analysis(data):
        session_code = data['session_code']
        question_id = data['question_id']
        emotion_summary = data.get('emotion_summary', {})

        if session_code in active_sessions:
            active_sessions[session_code]['is_analyzing'] = False
            active_sessions[session_code]['analysis_data'] = None

        emit('emotion_analysis_completed', {
            'question_id': question_id,
            'emotion_summary': emotion_summary,
            'message': 'Análisis emocional completado'
        }, room=session_code)

    @socketio.on('real_time_emotion')
    def on_real_time_emotion(data):
        session_code = data['session_code']
        emotion = data['emotion']
        confidence = data['confidence']

        # Store emotion data in session state
        if session_code in active_sessions and active_sessions[session_code]['is_analyzing']:
            if 'analysis_data' in active_sessions[session_code] and active_sessions[session_code]['analysis_data']:
                active_sessions[session_code]['analysis_data']['emotions_detected'].append({
                    'emotion': emotion,
                    'confidence': confidence,
                    'timestamp': datetime.now().isoformat()
                })

        # Only send to therapist
        session_participants = active_sessions.get(session_code, {}).get('participants', [])
        therapist_sids = [p['sid'] for p in session_participants if p['role'] == 'therapist']

        for sid in therapist_sids:
            emit('real_time_emotion', {
                'emotion': emotion,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat()
            }, room=sid)

    # WebRTC signaling with better STUN/TURN configuration
    @socketio.on('webrtc_offer')
    def on_webrtc_offer(data):
        session_code = data['session_code']
        emit('webrtc_offer', data, room=session_code, include_self=False)

    @socketio.on('webrtc_answer')
    def on_webrtc_answer(data):
        session_code = data['session_code']
        emit('webrtc_answer', data, room=session_code, include_self=False)

    @socketio.on('webrtc_ice_candidate')
    def on_webrtc_ice_candidate(data):
        session_code = data['session_code']
        emit('webrtc_ice_candidate', data, room=session_code, include_self=False)

    @socketio.on('session_completed')
    def on_session_completed(data):
        session_code = data['session_code']

        # Clean up session state
        if session_code in active_sessions:
            del active_sessions[session_code]

        emit('session_completed', {
            'message': 'La sesión ha sido completada por el terapeuta'
        }, room=session_code)

        # Force disconnect all participants after 3 seconds
        def disconnect_participants():
            emit('force_disconnect', {
                'message': 'Sesión finalizada. Serás redirigido automáticamente.'
            }, room=session_code)

        socketio.start_background_task(lambda: socketio.sleep(3) or disconnect_participants())

    app.socketio = socketio
    app.active_sessions = active_sessions
    return app


if __name__ == '__main__':
    app = create_app()

    # Create database tables
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database tables created successfully")
        except Exception as e:
            print(f"❌ Error creating database tables: {e}")

    print("🚀 Starting Therapy Meet API...")
    print("📊 Available endpoints:")
    print("   POST /api/auth/register")
    print("   POST /api/auth/login")
    print("   GET  /api/auth/profile")
    print("   POST /api/sessions")
    print("   GET  /api/sessions")
    print("   POST /api/sessions/join/<code>")
    print("   POST /api/detect-emotion")
    print("   POST /api/realtime/continuous-emotion")
    print("   GET  /api/health")

    # Use better configuration for production
    app.socketio.run(
        app,
        debug=True,
        host='0.0.0.0',
        port=5000,
        allow_unsafe_werkzeug=True
    )