from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from emotion_detector import get_emotion_detector
from models import db, User, Session, Question, EmotionAnalysis
import json
from datetime import datetime

realtime_bp = Blueprint('realtime', __name__)


@realtime_bp.route('/continuous-emotion', methods=['POST'])
@jwt_required()
def continuous_emotion_detection():
    """
    Endpoint para análisis continuo de emociones durante un período específico
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validar campos requeridos
        required_fields = ['session_id', 'question_id', 'emotions_data']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        session_id = data['session_id']
        question_id = data['question_id']
        emotions_data = data['emotions_data']  # Lista de emociones detectadas por segundo

        # Verificar sesión y pregunta
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        question = Question.query.get(question_id)
        if not question or question.session_id != session_id:
            return jsonify({'error': 'Question not found'}), 404

        # Verificar permisos
        if session.therapist_id != user.id and session.patient_id != user.id:
            return jsonify({'error': 'Access denied'}), 403

        # Procesar datos de emociones continuas
        emotion_counts = {}
        total_detections = len(emotions_data)
        confidence_sum = 0

        for emotion_data in emotions_data:
            emotion = emotion_data.get('emotion')
            confidence = emotion_data.get('confidence', 0)
            if emotion:
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
                confidence_sum += confidence

        # Calcular emoción dominante
        dominant_emotion = None
        dominant_percentage = 0
        if emotion_counts:
            dominant_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0]
            dominant_percentage = (emotion_counts[dominant_emotion] / total_detections) * 100

        # Calcular confianza promedio
        avg_confidence = confidence_sum / total_detections if total_detections > 0 else 0

        # Verificar si ya existe un análisis para esta pregunta
        existing_analysis = EmotionAnalysis.query.filter_by(question_id=question_id).first()

        if existing_analysis:
            # Actualizar análisis existente
            print(f"Updating existing analysis for question {question_id}")

            existing_analysis.dominant_emotion = dominant_emotion
            existing_analysis.dominant_percentage = dominant_percentage
            existing_analysis.avg_confidence = avg_confidence
            existing_analysis.total_detections = total_detections
            existing_analysis.emotion_counts = emotion_counts
            existing_analysis.raw_data = emotions_data
            existing_analysis.analysis_duration = data.get('duration', 0)
            existing_analysis.patient_response = data.get('patient_response', '')
            existing_analysis.timestamp = datetime.utcnow()

            db.session.commit()

            return jsonify({
                'message': 'Emotion analysis updated successfully',
                'analysis': {
                    'id': existing_analysis.id,
                    'dominant_emotion': dominant_emotion,
                    'dominant_percentage': round(dominant_percentage, 2),
                    'avg_confidence': round(avg_confidence, 3),
                    'total_detections': total_detections,
                    'emotion_counts': emotion_counts,
                    'duration': data.get('duration', 0)
                }
            }), 200
        else:
            # Crear nuevo análisis
            emotion_analysis = EmotionAnalysis(
                question_id=question_id,
                dominant_emotion=dominant_emotion,
                dominant_percentage=dominant_percentage,
                avg_confidence=avg_confidence,
                total_detections=total_detections,
                emotion_counts=emotion_counts,
                raw_data=emotions_data,
                analysis_duration=data.get('duration', 0),
                patient_response=data.get('patient_response', '')
            )

            db.session.add(emotion_analysis)
            db.session.commit()

            return jsonify({
                'message': 'Continuous emotion analysis saved successfully',
                'analysis': {
                    'id': emotion_analysis.id,
                    'dominant_emotion': dominant_emotion,
                    'dominant_percentage': round(dominant_percentage, 2),
                    'avg_confidence': round(avg_confidence, 3),
                    'total_detections': total_detections,
                    'emotion_counts': emotion_counts,
                    'duration': data.get('duration', 0)
                }
            }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error in continuous_emotion_detection: {str(e)}")
        return jsonify({
            'error': f'Failed to process continuous emotion analysis: {str(e)}'
        }), 500


@realtime_bp.route('/session/<int:session_id>/emotion-timeline', methods=['GET'])
@jwt_required()
def get_emotion_timeline(session_id):
    """
    Obtener timeline completo de emociones para una sesión
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        session = Session.query.get(session_id)

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Verificar permisos
        if session.therapist_id != user.id and session.patient_id != user.id:
            return jsonify({'error': 'Access denied'}), 403

        # Obtener todas las preguntas con sus análisis emocionales
        questions = Question.query.filter_by(session_id=session_id).order_by(Question.order_num.asc()).all()

        timeline = []
        session_emotion_summary = {}
        total_session_detections = 0

        for question in questions:
            question_data = {
                'question_id': question.id,
                'question_text': question.text,
                'order_num': question.order_num,
                'timestamp': question.timestamp.isoformat(),
                'emotion_analysis': None
            }

            if question.emotion_analysis:
                analysis = question.emotion_analysis
                question_data['emotion_analysis'] = {
                    'id': analysis.id,
                    'dominant_emotion': analysis.dominant_emotion,
                    'dominant_percentage': analysis.dominant_percentage,
                    'avg_confidence': analysis.avg_confidence,
                    'total_detections': analysis.total_detections,
                    'emotion_counts': analysis.emotion_counts,
                    'duration': analysis.analysis_duration,
                    'patient_response': analysis.patient_response,
                    'timestamp': analysis.timestamp.isoformat()
                }

                # Agregar al resumen de la sesión
                if analysis.emotion_counts:
                    for emotion, count in analysis.emotion_counts.items():
                        session_emotion_summary[emotion] = session_emotion_summary.get(emotion, 0) + count
                    total_session_detections += analysis.total_detections

            timeline.append(question_data)

        # Calcular estadísticas de la sesión
        session_stats = {
            'total_questions': len(questions),
            'questions_with_analysis': len([q for q in questions if q.emotion_analysis]),
            'total_detections': total_session_detections,
            'emotion_distribution': {},
            'dominant_session_emotion': None
        }

        if session_emotion_summary:
            # Calcular porcentajes
            for emotion, count in session_emotion_summary.items():
                percentage = (count / total_session_detections) * 100 if total_session_detections > 0 else 0
                session_stats['emotion_distribution'][emotion] = {
                    'count': count,
                    'percentage': round(percentage, 2)
                }

            # Emoción dominante de la sesión
            session_stats['dominant_session_emotion'] = max(
                session_emotion_summary.items(),
                key=lambda x: x[1]
            )[0]

        return jsonify({
            'session_id': session_id,
            'timeline': timeline,
            'session_stats': session_stats
        }), 200

    except Exception as e:
        return jsonify({
            'error': f'Failed to get emotion timeline: {str(e)}'
        }), 500


@realtime_bp.route('/question/<int:question_id>/analysis', methods=['GET'])
@jwt_required()
def get_question_analysis(question_id):
    """
    Obtener análisis específico de una pregunta
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        question = Question.query.get(question_id)
        if not question:
            return jsonify({'error': 'Question not found'}), 404

        session = Session.query.get(question.session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Verificar permisos
        if session.therapist_id != user.id and session.patient_id != user.id:
            return jsonify({'error': 'Access denied'}), 403

        if not question.emotion_analysis:
            return jsonify({'error': 'No analysis found for this question'}), 404

        analysis = question.emotion_analysis
        return jsonify({
            'question': {
                'id': question.id,
                'text': question.text,
                'order_num': question.order_num,
                'timestamp': question.timestamp.isoformat()
            },
            'analysis': {
                'id': analysis.id,
                'dominant_emotion': analysis.dominant_emotion,
                'dominant_percentage': analysis.dominant_percentage,
                'avg_confidence': analysis.avg_confidence,
                'total_detections': analysis.total_detections,
                'emotion_counts': analysis.emotion_counts,
                'duration': analysis.analysis_duration,
                'patient_response': analysis.patient_response,
                'raw_data': analysis.raw_data,
                'timestamp': analysis.timestamp.isoformat()
            }
        }), 200

    except Exception as e:
        return jsonify({
            'error': f'Failed to get question analysis: {str(e)}'
        }), 500
