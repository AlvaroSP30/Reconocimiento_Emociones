import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'mysql+pymysql://root:root@localhost/therapy_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'your-super-secret-jwt-key-here'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    MODEL_PATH = os.environ.get('MODEL_PATH') or 'models/model_weights.h5'
    CASCADE_PATH = os.environ.get('CASCADE_PATH') or 'models/haarcascade_frontalface_default.xml'
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    # WebRTC Configuration for better remote connectivity
    WEBRTC_CONFIG = {
        'iceServers': [
            {'urls': 'stun:stun.l.google.com:19302'},
            {'urls': 'stun:stun1.l.google.com:19302'},
            {'urls': 'stun:stun2.l.google.com:19302'},
            {'urls': 'stun:stun3.l.google.com:19302'},
            {'urls': 'stun:stun4.l.google.com:19302'},
            # Add TURN servers for better connectivity (you'll need to configure these)
            # {
            #     'urls': 'turn:your-turn-server.com:3478',
            #     'username': 'your-username',
            #     'credential': 'your-password'
            # }
        ],
        'iceCandidatePoolSize': 10
    }
