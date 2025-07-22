import React, { useState, useEffect } from 'react';
import type { Session } from '../types';
import { realtimeAPI } from '../utils/api';
import {
    ArrowLeft,
    BarChart3,
    Clock,
    MessageSquare,
    Brain,
    TrendingUp,
    Calendar,
    FileText,
    Loader2
} from 'lucide-react';

interface SessionDashboardProps {
    session: Session;
    onBack: () => void;
}

const SessionDashboard: React.FC<SessionDashboardProps> = ({ session, onBack }) => {
    const [emotionTimeline, setEmotionTimeline] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadEmotionTimeline();
    }, [session.id]);

    const loadEmotionTimeline = async () => {
        try {
            setLoading(true);
            const response = await realtimeAPI.getEmotionTimeline(session.id);
            setEmotionTimeline(response);
        } catch (error: any) {
            setError(error.message || 'Error al cargar el timeline de emociones');
        } finally {
            setLoading(false);
        }
    };

    const getEmotionColor = (emotion: string) => {
        const colors: Record<string, string> = {
            Happy: '#f1c40f',
            Sad: '#3498db',
            Angry: '#e74c3c',
            Fear: '#9b59b6',
            Surprise: '#f39c12',
            Disgust: '#27ae60',
            Neutral: '#95a5a6',
        };
        return colors[emotion] || '#bdc3c7';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <Loader2 className="spinner large" />
                    <h2>Cargando dashboard...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="session-dashboard">
            <header className="dashboard-header">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft className="button-icon" />
                    Volver
                </button>
                <div className="header-info">
                    <div className="header-title">
                        <BarChart3 className="title-icon" />
                        <h1>Dashboard de Sesión</h1>
                    </div>
                    <div className="session-meta">
                        <span className="session-code">Código: {session.session_code}</span>
                        <span className="session-date">
              <Calendar className="meta-icon" />
                            {formatDate(session.date_created)}
            </span>
                    </div>
                </div>
            </header>

            {error && (
                <div className="error-banner">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="error-close">×</button>
                </div>
            )}

            {emotionTimeline && (
                <div className="dashboard-content">
                    <div className="stats-overview">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <MessageSquare className="icon" />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{emotionTimeline.session_stats.total_questions}</div>
                                <div className="stat-label">Preguntas Totales</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">
                                <Brain className="icon" />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{emotionTimeline.session_stats.total_detections}</div>
                                <div className="stat-label">Detecciones Emocionales</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">
                                <TrendingUp className="icon" />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">
                                    {emotionTimeline.session_stats.dominant_session_emotion || 'N/A'}
                                </div>
                                <div className="stat-label">Emoción Dominante</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">
                                <Clock className="icon" />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{emotionTimeline.session_stats.questions_with_analysis}</div>
                                <div className="stat-label">Preguntas Analizadas</div>
                            </div>
                        </div>
                    </div>

                    {emotionTimeline.session_stats.emotion_distribution && (
                        <div className="emotion-distribution">
                            <h3>
                                <Brain className="section-icon" />
                                Distribución de Emociones
                            </h3>
                            <div className="emotion-chart">
                                {Object.entries(emotionTimeline.session_stats.emotion_distribution).map(
                                    ([emotion, data]: [string, any]) => (
                                        <div key={emotion} className="emotion-bar">
                                            <div className="emotion-info">
                                                <div className="emotion-label">
                                                    <div
                                                        className="emotion-color"
                                                        style={{ backgroundColor: getEmotionColor(emotion) }}
                                                    ></div>
                                                    <span className="emotion-name">{emotion}</span>
                                                </div>
                                                <span className="emotion-percentage">{data.percentage.toFixed(1)}%</span>
                                            </div>
                                            <div className="emotion-progress">
                                                <div
                                                    className="emotion-fill"
                                                    style={{
                                                        width: `${data.percentage}%`,
                                                        backgroundColor: getEmotionColor(emotion),
                                                    }}
                                                ></div>
                                            </div>
                                            <div className="emotion-count">{data.count} detecciones</div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    )}

                    <div className="questions-timeline">
                        <h3>
                            <Clock className="section-icon" />
                            Timeline de Preguntas
                        </h3>
                        <div className="timeline">
                            {emotionTimeline.timeline.map((questionData: any, index: number) => (
                                <div key={questionData.question_id} className="timeline-item">
                                    <div className="timeline-marker">
                                        <span className="marker-number">{index + 1}</span>
                                    </div>
                                    <div className="timeline-content">
                                        <div className="question-header">
                                            <h4>Pregunta {questionData.order_num}</h4>
                                            <span className="question-time">
                        {new Date(questionData.timestamp).toLocaleTimeString('es-ES')}
                      </span>
                                        </div>

                                        <div className="question-text">
                                            {questionData.question_text}
                                        </div>

                                        {questionData.emotion_analysis ? (
                                            <div className="emotion-analysis">
                                                <div className="analysis-header">
                                                    <Brain className="analysis-icon" />
                                                    <h5>Análisis Emocional</h5>
                                                </div>

                                                <div className="dominant-emotion">
                                                    <span className="emotion-label">Emoción dominante:</span>
                                                    <div
                                                        className="emotion-badge"
                                                        style={{
                                                            backgroundColor: getEmotionColor(questionData.emotion_analysis.dominant_emotion),
                                                        }}
                                                    >
                                                        {questionData.emotion_analysis.dominant_emotion}
                                                        ({questionData.emotion_analysis.dominant_percentage.toFixed(1)}%)
                                                    </div>
                                                </div>

                                                <div className="analysis-stats">
                                                    <div className="stat">
                                                        <span className="stat-label">Detecciones:</span>
                                                        <span className="stat-value">{questionData.emotion_analysis.total_detections}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Confianza:</span>
                                                        <span className="stat-value">
                              {(questionData.emotion_analysis.avg_confidence * 100).toFixed(1)}%
                            </span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="stat-label">Duración:</span>
                                                        <span className="stat-value">{questionData.emotion_analysis.duration}s</span>
                                                    </div>
                                                </div>

                                                {questionData.emotion_analysis.patient_response && (
                                                    <div className="patient-response">
                                                        <h6>Respuesta del paciente:</h6>
                                                        <p>{questionData.emotion_analysis.patient_response}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="no-analysis">
                                                <span>Sin análisis emocional</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {session.notes && (
                        <div className="session-notes">
                            <h3>
                                <FileText className="section-icon" />
                                Notas de la Sesión
                            </h3>
                            <div className="notes-content">
                                <p>{session.notes}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SessionDashboard;