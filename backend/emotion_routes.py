from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from emotion_detector import get_emotion_detector
from models import db, User, Session, Question, EmotionAnalysis
import json

emotion_bp = Blueprint('emotion', __name__)


@emotion_bp.route('/detect-emotion', methods=['POST'])
@jwt_required()
def detect_emotion():
    """
    Detect emotion from uploaded image or webcam capture
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        detector = get_emotion_detector()

        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Check if image data is provided
        if 'image' in data:
            # Detect emotion from base64 image
            result = detector.detect_emotion_from_base64(data['image'])
        else:
            # Capture from webcam
            result = detector.detect_emotion_from_webcam_capture()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'error': f'Emotion detection failed: {str(e)}',
            'detected': False
        }), 500


@emotion_bp.route('/sessions/<int:session_id>/emotion-summary', methods=['GET'])
@jwt_required()
def get_emotion_summary(session_id):
    """
    Get emotion summary for a session based on emotion analyses
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Check permissions
        if session.therapist_id != user.id and session.patient_id != user.id:
            return jsonify({'error': 'Access denied'}), 403

        # Get all questions with emotion analyses for this session
        questions = Question.query.filter_by(session_id=session_id).all()

        emotion_counts = {}
        emotion_confidences = {}
        timeline = []
        total_analyses = 0

        for question in questions:
            if question.emotion_analysis:
                analysis = question.emotion_analysis
                dominant_emotion = analysis.dominant_emotion
                avg_confidence = analysis.avg_confidence or 0

                if dominant_emotion:
                    # Count dominant emotions
                    if dominant_emotion in emotion_counts:
                        emotion_counts[dominant_emotion] += 1
                        emotion_confidences[dominant_emotion].append(avg_confidence)
                    else:
                        emotion_counts[dominant_emotion] = 1
                        emotion_confidences[dominant_emotion] = [avg_confidence]

                    total_analyses += 1

                # Add to timeline
                timeline.append({
                    'question_order': question.order_num,
                    'question_text': question.text,
                    'dominant_emotion': dominant_emotion,
                    'dominant_percentage': analysis.dominant_percentage,
                    'avg_confidence': avg_confidence,
                    'total_detections': analysis.total_detections,
                    'emotion_counts': analysis.emotion_counts,
                    'duration': analysis.analysis_duration,
                    'timestamp': analysis.timestamp.isoformat(),
                    'patient_response': analysis.patient_response
                })

        # Calculate statistics
        emotion_stats = {}
        for emotion, counts in emotion_counts.items():
            confidences = emotion_confidences[emotion]
            emotion_stats[emotion] = {
                'count': counts,
                'percentage': round((counts / total_analyses) * 100, 2) if total_analyses > 0 else 0,
                'avg_confidence': round(sum(confidences) / len(confidences), 3) if confidences else 0,
                'min_confidence': round(min(confidences), 3) if confidences else 0,
                'max_confidence': round(max(confidences), 3) if confidences else 0
            }

        # Find dominant emotion
        dominant_emotion = None
        if emotion_counts:
            dominant_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0]

        return jsonify({
            'session_id': session_id,
            'total_analyses': total_analyses,
            'emotion_counts': emotion_counts,
            'emotion_stats': emotion_stats,
            'dominant_emotion': dominant_emotion,
            'timeline': sorted(timeline, key=lambda x: x['question_order'])
        }), 200

    except Exception as e:
        return jsonify({
            'error': f'Failed to get emotion summary: {str(e)}'
        }), 500


@emotion_bp.route('/test-emotion-detector', methods=['GET'])
def test_emotion_detector():
    """
    Test endpoint to check if emotion detector is working
    """
    try:
        detector = get_emotion_detector()
        return jsonify({
            'status': 'Emotion detector initialized successfully',
            'emotion_labels': detector.emotion_labels
        }), 200
    except Exception as e:
        return jsonify({
            'error': f'Emotion detector not available: {str(e)}'
        }), 500