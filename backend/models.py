from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('therapist', 'patient'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    therapist_sessions = db.relationship('Session', foreign_keys='Session.therapist_id', backref='therapist',
                                         lazy='dynamic')
    patient_sessions = db.relationship('Session', foreign_keys='Session.patient_id', backref='patient', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat()
        }


class Session(db.Model):
    __tablename__ = 'sessions'

    id = db.Column(db.Integer, primary_key=True)
    therapist_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    session_code = db.Column(db.String(20), unique=True, nullable=False)
    status = db.Column(db.Enum('waiting', 'active', 'completed'), default='waiting')
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    date_started = db.Column(db.DateTime, nullable=True)
    date_completed = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    questions = db.relationship('Question', backref='session', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'therapist_id': self.therapist_id,
            'patient_id': self.patient_id,
            'session_code': self.session_code,
            'status': self.status,
            'date_created': self.date_created.isoformat(),
            'date_started': self.date_started.isoformat() if self.date_started else None,
            'date_completed': self.date_completed.isoformat() if self.date_completed else None,
            'notes': self.notes,
            'therapist': self.therapist.username if self.therapist else None,
            'patient': self.patient.username if self.patient else None
        }


class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    order_num = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships - solo mantener emotion_analysis
    emotion_analysis = db.relationship('EmotionAnalysis', backref='question', uselist=False,
                                       cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'text': self.text,
            'order_num': self.order_num,
            'timestamp': self.timestamp.isoformat(),
            'emotion_analysis': self.emotion_analysis.to_dict() if self.emotion_analysis else None
        }


class EmotionAnalysis(db.Model):
    __tablename__ = 'emotion_analyses'

    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    dominant_emotion = db.Column(db.String(50), nullable=True)
    dominant_percentage = db.Column(db.Float, nullable=True)
    avg_confidence = db.Column(db.Float, nullable=True)
    total_detections = db.Column(db.Integer, nullable=False, default=0)
    emotion_counts = db.Column(db.JSON, nullable=True)  # {"Happy": 5, "Sad": 2, etc.}
    raw_data = db.Column(db.JSON, nullable=True)  # Datos completos de cada detección
    analysis_duration = db.Column(db.Integer, nullable=True)  # Duración en segundos
    patient_response = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'question_id': self.question_id,
            'dominant_emotion': self.dominant_emotion,
            'dominant_percentage': self.dominant_percentage,
            'avg_confidence': self.avg_confidence,
            'total_detections': self.total_detections,
            'emotion_counts': self.emotion_counts,
            'analysis_duration': self.analysis_duration,
            'patient_response': self.patient_response,
            'timestamp': self.timestamp.isoformat()
        }