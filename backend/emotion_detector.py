import cv2
import numpy as np
from tensorflow.keras.models import load_model
import base64
from PIL import Image
import io
import os
from pathlib import Path


class EmotionDetector:
    def __init__(self, model_path, cascade_path):
        """
        Initialize the emotion detector with model and cascade paths
        """
        self.emotion_labels = [
            'Angry',
            'Disgust',
            'Fear',
            'Happy',
            'Neutral',
            'Sad',
            'Surprise'
        ]

        # Load the trained model
        if os.path.exists(model_path):
            self.model = load_model(model_path)
        else:
            raise FileNotFoundError(f"Model file not found at {model_path}")

        # Load face cascade classifier
        if os.path.exists(cascade_path):
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
        else:
            raise FileNotFoundError(f"Cascade file not found at {cascade_path}")

    def detect_emotion_from_base64(self, image_base64):
        """
        Detect emotion from a base64 encoded image

        Args:
            image_base64 (str): Base64 encoded image

        Returns:
            dict: Detection results including emotion, confidence, and all probabilities
        """
        try:
            # Decode base64 image
            if image_base64.startswith('data:image'):
                # Remove data URL prefix
                image_base64 = image_base64.split(',')[1]

            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))

            # Convert PIL image to OpenCV format
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            return self.detect_emotion_from_frame(frame)

        except Exception as e:
            return {
                'error': f'Error processing image: {str(e)}',
                'detected': False
            }

    def detect_emotion_from_frame(self, frame):
        """
        Detect emotion from an OpenCV frame

        Args:
            frame: OpenCV image frame

        Returns:
            dict: Detection results
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.3,
                minNeighbors=5,
                minSize=(30, 30)
            )

            if len(faces) == 0:
                return {
                    'detected': False,
                    'message': 'No face detected in the image'
                }

            # Process the first (largest) face found
            face_results = []

            for (x, y, w, h) in faces:
                # Extract face region
                roi_gray = gray[y:y + h, x:x + w]

                # Resize to model input size (48x48)
                roi_gray = cv2.resize(roi_gray, (48, 48))

                # Normalize and reshape for model
                roi_gray = roi_gray.reshape(1, 48, 48, 1)
                roi_gray = roi_gray / 255.0

                # Predict emotion
                emotion_predictions = self.model.predict(roi_gray, verbose=0)
                emotion_probabilities = emotion_predictions[0]

                # Get dominant emotion
                dominant_emotion_index = np.argmax(emotion_probabilities)
                dominant_emotion = self.emotion_labels[dominant_emotion_index]
                confidence = float(emotion_probabilities[dominant_emotion_index])

                # Create probability dictionary
                emotion_probs = {}
                for i, emotion in enumerate(self.emotion_labels):
                    emotion_probs[emotion] = float(emotion_probabilities[i])

                face_results.append({
                    'face_coordinates': {
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h)
                    },
                    'emotion': dominant_emotion,
                    'confidence': confidence,
                    'all_emotions': emotion_probs
                })

            # Return result for the first face (main subject)
            main_result = face_results[0]

            return {
                'detected': True,
                'emotion': main_result['emotion'],
                'confidence': main_result['confidence'],
                'face_coordinates': main_result['face_coordinates'],
                'all_emotions': main_result['all_emotions'],
                'total_faces_detected': len(faces),
                'timestamp': self._get_timestamp()
            }

        except Exception as e:
            return {
                'error': f'Error detecting emotion: {str(e)}',
                'detected': False
            }

    def detect_emotion_from_webcam_capture(self):
        """
        Capture a single frame from webcam and detect emotion

        Returns:
            dict: Detection results
        """
        try:
            # Initialize camera
            cap = cv2.VideoCapture(0)

            if not cap.isOpened():
                return {
                    'error': 'Could not access webcam',
                    'detected': False
                }

            # Capture frame
            ret, frame = cap.read()
            cap.release()

            if not ret:
                return {
                    'error': 'Could not capture frame from webcam',
                    'detected': False
                }

            # Flip frame horizontally (mirror effect)
            frame = cv2.flip(frame, 1)

            return self.detect_emotion_from_frame(frame)

        except Exception as e:
            return {
                'error': f'Error accessing webcam: {str(e)}',
                'detected': False
            }

    def _get_timestamp(self):
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().isoformat()


# Global detector instance (will be initialized in app.py)
emotion_detector = None


def init_emotion_detector(model_path, cascade_path):
    """Initialize the global emotion detector instance"""
    global emotion_detector
    emotion_detector = EmotionDetector(model_path, cascade_path)
    return emotion_detector


def get_emotion_detector():
    """Get the global emotion detector instance"""
    global emotion_detector
    if emotion_detector is None:
        raise RuntimeError("Emotion detector not initialized. Call init_emotion_detector first.")
    return emotion_detector