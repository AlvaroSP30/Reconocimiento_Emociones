from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Session, Question, EmotionAnalysis
from marshmallow import Schema, fields, ValidationError
import random
import string
from datetime import datetime

sessions_bp = Blueprint('sessions', __name__)


class SessionCreateSchema(Schema):
    notes = fields.Str(missing='')


class QuestionCreateSchema(Schema):
    text = fields.Str(required=True, validate=lambda x: len(x.strip()) > 0)


def generate_session_code():
    """Generate a unique 8-character session code"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not Session.query.filter_by(session_code=code).first():
            return code


@sessions_bp.route('/sessions', methods=['POST'])
@jwt_required()
def create_session():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'therapist':
        return jsonify({'error': 'Only therapists can create sessions'}), 403

    try:
        schema = SessionCreateSchema()
        data = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({'error': 'Validation error', 'messages': err.messages}), 400

    session = Session(
        therapist_id=user_id,
        session_code=generate_session_code(),
        notes=data['notes']
    )

    db.session.add(session)
    db.session.commit()

    return jsonify({
        'message': 'Session created successfully',
        'session': session.to_dict()
    }), 201


@sessions_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.role == 'therapist':
        sessions = Session.query.filter_by(therapist_id=user_id).order_by(Session.date_created.desc()).all()
    else:
        sessions = Session.query.filter_by(patient_id=user_id).order_by(Session.date_created.desc()).all()

    return jsonify({
        'sessions': [session.to_dict() for session in sessions]
    }), 200


@sessions_bp.route('/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_session(session_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    session = Session.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Check if user has access to this session
    if session.therapist_id != user.id and session.patient_id != user.id:
        return jsonify({'error': 'Access denied'}), 403

    # Get all questions and emotion analyses for this session
    questions = Question.query.filter_by(session_id=session_id).order_by(Question.order_num.asc()).all()

    session_data = session.to_dict()
    session_data['questions'] = [question.to_dict() for question in questions]

    return jsonify({'session': session_data}), 200


@sessions_bp.route('/sessions/join/<session_code>', methods=['POST'])
@jwt_required()
def join_session(session_code):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'patient':
        return jsonify({'error': 'Only patients can join sessions'}), 403

    session = Session.query.filter_by(session_code=session_code).first()
    if not session:
        return jsonify({'error': 'Invalid session code'}), 404

    if session.status not in ['waiting', 'active']:
        return jsonify({'error': 'Session is not available for joining'}), 400

    if session.patient_id and session.patient_id != user.id:
        return jsonify({'error': 'Session already has a patient'}), 400

    # Join the session
    session.patient_id = user.id
    session.status = 'active'
    if not session.date_started:
        session.date_started = datetime.utcnow()

    db.session.commit()

    return jsonify({
        'message': 'Successfully joined session',
        'session': session.to_dict()
    }), 200


@sessions_bp.route('/sessions/<int:session_id>/questions', methods=['POST'])
@jwt_required()
def add_question(session_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    session = Session.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if session.therapist_id != user.id:
        return jsonify({'error': 'Only the session therapist can add questions'}), 403

    try:
        schema = QuestionCreateSchema()
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'error': 'Validation error', 'messages': err.messages}), 400

    # Get the next order number
    last_question = Question.query.filter_by(session_id=session_id).order_by(Question.order_num.desc()).first()
    order_num = (last_question.order_num + 1) if last_question else 1

    question = Question(
        session_id=session_id,
        text=data['text'].strip(),
        order_num=order_num
    )

    db.session.add(question)
    db.session.commit()

    return jsonify({
        'message': 'Question added successfully',
        'question': question.to_dict()
    }), 201


@sessions_bp.route('/sessions/<int:session_id>/complete', methods=['PUT'])
@jwt_required()
def complete_session(session_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    session = Session.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if session.therapist_id != user.id:
        return jsonify({'error': 'Only the session therapist can complete sessions'}), 403

    session.status = 'completed'
    session.date_completed = datetime.utcnow()

    if request.json and 'notes' in request.json:
        session.notes = request.json['notes']

    db.session.commit()

    return jsonify({
        'message': 'Session completed successfully',
        'session': session.to_dict()
    }), 200


@sessions_bp.route('/sessions/<int:session_id>/dashboard', methods=['GET'])
@jwt_required()
def get_session_dashboard(session_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    session = Session.query.get(session_id)

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if session.therapist_id != user.id:
        return jsonify({'error': 'Only the session therapist can view dashboard'}), 403

    # Get all questions with their emotion analyses
    questions = Question.query.filter_by(session_id=session_id).order_by(Question.order_num.asc()).all()

    # Analyze emotions from emotion_analysis table
    emotion_summary = {}
    total_analyses = 0
    questions_data = []

    for question in questions:
        question_data = question.to_dict()

        if question.emotion_analysis:
            analysis = question.emotion_analysis
            dominant_emotion = analysis.dominant_emotion

            if dominant_emotion:
                if dominant_emotion in emotion_summary:
                    emotion_summary[dominant_emotion] += 1
                else:
                    emotion_summary[dominant_emotion] = 1
                total_analyses += 1

        questions_data.append(question_data)

    # Calculate emotion percentages
    emotion_percentages = {}
    if total_analyses > 0:
        for emotion, count in emotion_summary.items():
            emotion_percentages[emotion] = round((count / total_analyses) * 100, 2)

    return jsonify({
        'session': session.to_dict(),
        'questions': questions_data,
        'emotion_summary': {
            'counts': emotion_summary,
            'percentages': emotion_percentages,
            'total_analyses': total_analyses,
            'dominant_emotion': max(emotion_summary.items(), key=lambda x: x[1])[0] if emotion_summary else None
        }
    }), 200


@sessions_bp.route('/sessions/<int:session_id>/questions/<int:question_id>/can-proceed', methods=['GET'])
@jwt_required()
def can_proceed_to_next_question(session_id, question_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Verificar permisos
        if session.therapist_id != user.id and session.patient_id != user.id:
            return jsonify({'error': 'Access denied'}), 403

        question = Question.query.get(question_id)
        if not question or question.session_id != session_id:
            return jsonify({'error': 'Question not found'}), 404

        # Verificar si existe análisis emocional para esta pregunta
        emotion_analysis = EmotionAnalysis.query.filter_by(question_id=question_id).first()
        has_analysis = emotion_analysis is not None

        # Lógica de navegación:

            # El terapeuta puede avanzar si hay análisis o si es la primera pregunta
        can_proceed = has_analysis or question.order == 1


        return jsonify({
            'can_proceed': can_proceed,
            'has_analysis': has_analysis,
            'question_id': question_id,
            'user_role': user.role
        }), 200

    except Exception as e:
        return jsonify({
            'error': f'Failed to check proceed status: {str(e)}'
        }), 500
