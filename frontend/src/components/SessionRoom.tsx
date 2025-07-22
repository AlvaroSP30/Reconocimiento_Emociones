import React, {useState, useEffect, useContext, useRef} from 'react';
import {AuthContext} from '../context/AuthContext';
import type {Session, Question} from '../types';
import {sessionsAPI, realtimeAPI} from '../utils/api';
import ContinuousEmotionCapture from './ContinuousEmotionCapture';
import WebRTCManager from './WebRTCManager';
import {io, type Socket} from 'socket.io-client';
import {
    ArrowLeft,
    MessageSquare,
    Mic,
    MicOff,
    Send,
    Square,
    ChevronLeft,
    ChevronRight,
    Users,
    Clock,
    CheckCircle,
    AlertCircle,
    Target
} from 'lucide-react';

interface SessionRoomProps {
    session: Session;
    onBack: () => void;
    onSessionCompleted?: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const SessionRoom: React.FC<SessionRoomProps> = ({
                                                     session: initialSession,
                                                     onBack,
                                                     onSessionCompleted
                                                 }) => {
    const [session, setSession] = useState<Session>(initialSession);
    const [emotionAnalysisDuration, setEmotionAnalysisDuration] = useState<number>(10);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionNotes, setSessionNotes] = useState(session.notes || '');
    const [patientResponse, setPatientResponse] = useState('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isAnalyzingEmotion, setIsAnalyzingEmotion] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [participantsCount, setParticipantsCount] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [currentEmotionData, setCurrentEmotionData] = useState<any>(null);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [canProceedToNext, setCanProceedToNext] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

    const authContext = useContext(AuthContext);
    const isTherapist = authContext?.user?.role === 'therapist';
    const isPatient = authContext?.user?.role === 'patient';

    console.log('AuthContext:', {
        user: authContext?.user,
        role: authContext?.user?.role,
        isTherapist,
        isPatient
    });

    if (!authContext?.user) {
        return <div>Error: No estás autenticado. Por favor, inicia sesión.</div>;
    }

    const speechRecognitionRef = useRef<any>(null);
    // @ts-ignore
    const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
    // @ts-ignore
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        console.log('Iniciando useEffect para inicializar Socket.IO');
        initializeSocket();
        return () => {
            cleanup();
        };
    }, [session.id, authContext?.user]);

    const initializeSocket = () => {
        console.log('🔌 Inicializando conexión SocketIO...');

        const newSocket: Socket = io('https://902d6842e03e.ngrok-free.app', {
            transports: ['polling', 'websocket'],
            extraHeaders: {
                'ngrok-skip-browser-warning': 'true',
            },
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ SocketIO conectado');
            setConnectionStatus('connected');
            setError('');

            setTimeout(() => {
                newSocket.emit('join_session', {
                    session_code: session.session_code,
                    user_role: authContext?.user?.role,
                    username: authContext?.user?.username,
                });
            }, 500);
        });

        newSocket.on('disconnect', () => {
            console.log('❌ SocketIO desconectado');
            setConnectionStatus('disconnected');
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ Error de conexión SocketIO:', error);
            setConnectionStatus('disconnected');
            setError('Error de conexión al servidor');
        });

        newSocket.on('user_joined', (data) => {
            console.log('👤 Usuario unido:', data.username, data.role);
            setParticipantsCount(data.participants_count || 0);
        });

        newSocket.on('session_state_update', (data) => {
            console.log('📥 Actualización de estado de sesión:', data);
            setCurrentQuestionIndex(data.current_question_index);
            setIsAnalyzingEmotion(data.is_analyzing);
            setParticipantsCount(data.participants_count || 0);
        });

        newSocket.on('new_question', (data) => {
            console.log('📥 Nueva pregunta recibida:', data);
            if (isPatient) {
                speakText(data.question_text);
                loadSessionDetails();
            }
        });

        newSocket.on('question_index_updated', (data) => {
            console.log('📥 Índice de pregunta actualizado:', data);
            setCurrentQuestionIndex(data.question_index);
            setCurrentEmotionData(null);
            checkCanProceed(data.question_index);
        });

        newSocket.on('emotion_analysis_started', (data) => {
            console.log('📥 Análisis emocional iniciado:', data);
            setIsAnalyzingEmotion(true);
            setAnalysisProgress(0);
            setCurrentEmotionData(null);

            let progress = 0;
            progressTimerRef.current = setInterval(() => {
                progress += 100 / data.duration;
                setAnalysisProgress(Math.min(progress, 100));
                if (progress >= 100) {
                    if (progressTimerRef.current) {
                        clearInterval(progressTimerRef.current);
                    }
                }
            }, 1000);
        });

        newSocket.on('emotion_analysis_completed', (data) => {
            console.log('📥 Análisis emocional completado:', data);
            setIsAnalyzingEmotion(false);
            setAnalysisProgress(0);
            setCurrentEmotionData(data.emotion_summary);

            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
            }

            loadSessionDetails();
            checkCanProceed(currentQuestionIndex);
        });

        newSocket.on('can_proceed_update', (data) => {
            console.log('📥 Actualización de can_proceed recibida:', data);
            setCanProceedToNext(data.can_proceed);
        });

        newSocket.on('session_completed', () => {
            console.log('📥 Sesión completada');
            if (isPatient) {
                setTimeout(() => {
                    onBack();
                }, 2000);
            }
        });

        if (isTherapist && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'es-ES';

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setNewQuestion(transcript);
                setIsRecording(false);
            };

            recognition.onerror = (error: any) => {
                console.error('Error en reconocimiento de voz:', error);
                setIsRecording(false);
            };

            recognition.onend = () => {
                console.log('Reconocimiento de voz finalizado');
                setIsRecording(false);
            };

            speechRecognitionRef.current = recognition;
        }

        setTimeout(() => {
            console.log('Llamando a loadSessionDetails desde initializeSocket');
            loadSessionDetails();
        }, 1000);
    };

    const cleanup = () => {
        console.log('🧹 Limpiando recursos de Socket.IO');
        if (socket) {
            socket.emit('leave_session', {
                session_code: session.session_code,
                username: authContext?.user?.username,
            });
            socket.disconnect();
        }

        if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };

    const loadSessionDetails = async () => {
        try {
            console.log('Cargando detalles de la sesión:', {sessionId: session.id});
            const response = await sessionsAPI.getSession(session.id);
            console.log('Detalles de la sesión recibidos:', response);
            setSession(response.session);
            setQuestions(response.session.questions || []);

            if (response.session.questions && response.session.questions.length > 0) {
                console.log('Llamando a checkCanProceed desde loadSessionDetails');
                checkCanProceed(currentQuestionIndex);
            }
        } catch (error: any) {
            console.error('Error al cargar detalles de la sesión:', error);
            setError(error.message || 'Error al cargar detalles de la sesión');
        }
    };

    const checkCanProceed = async (questionIndex: number) => {
        console.log('checkCanProceed ejecutado:', {isTherapist, isPatient, questionIndex});

        if (questions.length === 0) {
            console.log('checkCanProceed omitido: no hay preguntas');
            return;
        }

        const currentQuestion = questions[questionIndex];
        if (!currentQuestion) {
            console.log('checkCanProceed omitido: pregunta no encontrada');
            return;
        }

        try {
            console.log('Enviando solicitud a /can-proceed:', {
                sessionId: session.id,
                questionId: currentQuestion.id
            });
            const response = await sessionsAPI.canProceedToNextQuestion(session.id, currentQuestion.id);
            console.log('Respuesta de /can-proceed:', response);
            setCanProceedToNext(response.can_proceed);

            socket?.emit('can_proceed_update', {
                session_code: session.session_code,
                question_index: questionIndex,
                can_proceed: response.can_proceed,
            });
        } catch (error) {
            console.error('Error checking if can proceed:', error);

        }
    };

    const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
            console.log('Reproduciendo texto con speechSynthesis:', text);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        } else {
            console.warn('SpeechSynthesis no está soportado en este navegador');
        }
    };

    const startVoiceRecording = () => {
        if (speechRecognitionRef.current && !isRecording) {
            console.log('Iniciando grabación de voz');
            setIsRecording(true);
            try {
                speechRecognitionRef.current.start();
            } catch (error) {
                console.error('Error al iniciar grabación de voz:', error);
                setIsRecording(false);
            }
        }
    };

    const stopVoiceRecording = () => {
        if (speechRecognitionRef.current && isRecording) {
            console.log('Deteniendo grabación de voz');
            speechRecognitionRef.current.stop();
        }
    };

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || !isTherapist) return;

        console.log('Agregando nueva pregunta:', newQuestion);
        setLoading(true);
        try {
            const response = await sessionsAPI.addQuestion(session.id, {
                text: newQuestion.trim(),
            });

            const updatedQuestions = [...questions, response.question];
            setQuestions(updatedQuestions);
            setNewQuestion('');

            socket?.emit('therapist_question', {
                session_code: session.session_code,
                question_text: newQuestion.trim(),
                question_id: response.question.id,
                timestamp: new Date().toISOString(),
            });

            speakText(newQuestion.trim());
        } catch (error: any) {
            console.error('Error al agregar pregunta:', error);
            setError(error.message || 'Error al agregar pregunta');
        } finally {
            setLoading(false);
        }
    };

    const handleStartEmotionAnalysis = () => {
        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion || !isTherapist || isAnalyzingEmotion) return;

        if (currentQuestion.emotion_analysis) {
            console.warn('Esta pregunta ya tiene un análisis completado');
            setError('Esta pregunta ya tiene un análisis completado');
            return;
        }

        console.log('Iniciando análisis emocional:', {
            questionId: currentQuestion.id,
            duration: emotionAnalysisDuration
        });
        setIsAnalyzingEmotion(true);
        setCurrentEmotionData(null);
        setAnalysisProgress(0);

        socket?.emit('start_emotion_analysis', {
            session_code: session.session_code,
            question_id: currentQuestion.id,
            duration: emotionAnalysisDuration,
        });

        analysisTimerRef.current = setTimeout(() => {
            console.log('Finalizando análisis emocional por timeout:', emotionAnalysisDuration);
            handleStopEmotionAnalysis();
        }, emotionAnalysisDuration * 1000);
    };
    const handleStopEmotionAnalysis = () => {
        if (!isAnalyzingEmotion) return;

        console.log('Deteniendo análisis emocional');
        setIsAnalyzingEmotion(false);
        setAnalysisProgress(0);

        if (analysisTimerRef.current) {
            clearTimeout(analysisTimerRef.current);
            analysisTimerRef.current = null;
        }

        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }

        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return;

        socket?.emit('stop_emotion_analysis', {
            session_code: session.session_code,
            question_id: currentQuestion.id,
        });
    };

    const handleEmotionAnalysisComplete = async (analysisData: any) => {
        console.log('Análisis emocional completado:', analysisData);
        try {
            await realtimeAPI.saveContinuousEmotion(
                session.id,
                questions[currentQuestionIndex]?.id,
                analysisData,
                patientResponse,
                emotionAnalysisDuration,
            );

            setPatientResponse('');
            setCurrentEmotionData(analysisData);

            socket?.emit('emotion_analysis_completed', {
                session_code: session.session_code,
                question_id: questions[currentQuestionIndex]?.id,
                emotion_summary: analysisData,
            });

            await loadSessionDetails();
        } catch (error: any) {
            console.error('Error al guardar análisis emocional:', error);
            setError(error.message || 'Error al guardar análisis emocional');
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1 && canProceedToNext) {
            const newIndex = currentQuestionIndex + 1;
            console.log('Navegando a la siguiente pregunta:', newIndex);
            setCurrentQuestionIndex(newIndex);
            setCurrentEmotionData(null);

            socket?.emit('update_question_index', {
                session_code: session.session_code,
                question_index: newIndex,
            });

            checkCanProceed(newIndex);
        } else {
            console.log('No se puede avanzar:', {
                currentQuestionIndex,
                questionsLength: questions.length,
                canProceedToNext
            });
        }
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            const newIndex = currentQuestionIndex - 1;
            console.log('Navegando a la pregunta anterior:', newIndex);
            setCurrentQuestionIndex(newIndex);
            setCurrentEmotionData(null);

            socket?.emit('update_question_index', {
                session_code: session.session_code,
                question_index: newIndex,
            });

            checkCanProceed(newIndex);
        } else {
            console.log('No se puede retroceder: ya en la primera pregunta');
        }
    };

    const handleCompleteSession = async () => {
        if (!isTherapist) return;

        console.log('Completando sesión:', session.id);
        try {
            setLoading(true);
            await sessionsAPI.completeSession(session.id, sessionNotes);

            socket?.emit('session_completed', {
                session_code: session.session_code,
            });

            onSessionCompleted?.();
        } catch (error: any) {
            console.error('Error al completar sesión:', error);
            setError(error.message || 'Error al completar sesión');
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

    const currentQuestion = questions[currentQuestionIndex];
    const hasAnalysis = currentQuestion?.emotion_analysis;

    return (
        <div className="session-room">
            <header className="session-header">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft className="button-icon"/>
                    Salir
                </button>

                <div className="session-info">
                    <h1>Sesión {session.session_code}</h1>
                    <div className="session-meta">
                        <div className="meta-item">
                            <Users className="meta-icon"/>
                            <span>{participantsCount} participantes</span>
                        </div>
                        <div className="meta-item">
                            <div className={`status-indicator ${connectionStatus}`}></div>
                            <span>{connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}</span>
                        </div>
                    </div>
                </div>

                {isTherapist && (
                    <div className="session-controls">
                        <label htmlFor="duration">Duración análisis:</label>
                        <select
                            id="duration"
                            value={emotionAnalysisDuration}
                            onChange={(e) => {
                                const newDuration = Number(e.target.value);
                                console.log('Actualizando emotionAnalysisDuration:', newDuration);
                                setEmotionAnalysisDuration(newDuration);
                            }}
                            disabled={isAnalyzingEmotion}
                            className="duration-select"
                        >
                            <option value={5}>5 segundos</option>
                            <option value={10}>10 segundos</option>
                            <option value={15}>15 segundos</option>
                            <option value={20}>20 segundos</option>
                        </select>
                    </div>
                )}
            </header>

            {error && (
                <div className="error-banner">
                    <AlertCircle className="error-icon"/>
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="error-close">×</button>
                </div>
            )}

            <div className="session-content">
                <div className="video-section">
                    <WebRTCManager
                        sessionCode={session.session_code}
                        userRole={authContext?.user?.role || 'patient'}
                        socket={socket}
                        isTherapist={isTherapist}
                    />
                </div>

                <div className="interaction-section">
                    {isTherapist && (
                        <div className="therapist-panel">
                            <div className="question-input">
                                <h3>
                                    <MessageSquare className="section-icon"/>
                                    Hacer Pregunta
                                </h3>
                                <form onSubmit={handleAddQuestion} className="question-form">
                                    <div className="input-group">
                                        <textarea
                                            value={newQuestion}
                                            onChange={(e) => setNewQuestion(e.target.value)}
                                            placeholder="Escribe tu pregunta aquí..."
                                            disabled={loading || isAnalyzingEmotion || connectionStatus !== 'connected'}
                                            rows={3}
                                            className="question-textarea"
                                        />
                                        <div className="input-actions">
                                            {speechRecognitionRef.current && (
                                                <button
                                                    type="button"
                                                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                                                    disabled={loading || connectionStatus !== 'connected'}
                                                    className={`voice-button ${isRecording ? 'recording' : ''}`}
                                                >
                                                    {isRecording ? <MicOff className="button-icon"/> :
                                                        <Mic className="button-icon"/>}
                                                    {isRecording ? 'Grabando...' : 'Hablar'}
                                                </button>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={loading || !newQuestion.trim() || isAnalyzingEmotion || connectionStatus !== 'connected'}
                                                className="send-button"
                                            >
                                                <Send className="button-icon"/>
                                                Enviar
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="question-display">
                                <div className="question-header">
                                    <h3>
                                        Pregunta {currentQuestionIndex + 1} de {questions.length}
                                    </h3>
                                    <div className="question-navigation">
                                        <button
                                            onClick={handlePreviousQuestion}
                                            disabled={currentQuestionIndex === 0}
                                            className="nav-button"
                                        >
                                            <ChevronLeft className="button-icon"/>
                                        </button>
                                        <button
                                            onClick={handleNextQuestion}
                                            disabled={currentQuestionIndex >= questions.length - 1 || !canProceedToNext}
                                            className="nav-button"
                                            title={!canProceedToNext ? 'Completa el análisis emocional para continuar' : ''}
                                        >
                                            <ChevronRight className="button-icon"/>
                                        </button>
                                    </div>
                                </div>

                                {currentQuestion ? (
                                    <div className="question-card">
                                        <div className="question-text">{currentQuestion.text}</div>

                                        <div className="analysis-section">
                                            {!hasAnalysis && !isAnalyzingEmotion && connectionStatus === 'connected' && (
                                                <button
                                                    onClick={handleStartEmotionAnalysis}
                                                    className="start-analysis-button"
                                                >
                                                    <Target className="button-icon"/>
                                                    Iniciar Análisis ({emotionAnalysisDuration}s)
                                                </button>
                                            )}

                                            {isAnalyzingEmotion && (
                                                <div className="analysis-active">
                                                    <div className="analysis-header">
                                                        <span className="analysis-text">Analizando emociones...</span>
                                                        <button
                                                            onClick={handleStopEmotionAnalysis}
                                                            className="stop-button"
                                                        >
                                                            <Square className="button-icon"/>
                                                            Detener
                                                        </button>
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div
                                                            className="progress-fill"
                                                            style={{width: `${analysisProgress}%`}}
                                                        ></div>
                                                    </div>
                                                    <span
                                                        className="progress-text">{Math.round(analysisProgress)}%</span>
                                                </div>
                                            )}

                                            {isAnalyzingEmotion && currentEmotionData && (
                                                <div className="real-time-emotion">
                                                    <h4>Emoción Actual</h4>
                                                    <div
                                                        className="emotion-badge"
                                                        style={{backgroundColor: getEmotionColor(currentEmotionData.emotion)}}
                                                    >
                                                        {currentEmotionData.emotion} ({(currentEmotionData.confidence * 100).toFixed(1)}%)
                                                    </div>
                                                </div>
                                            )}

                                            {hasAnalysis && (
                                                <div className="analysis-result">
                                                    <div className="result-header">
                                                        <CheckCircle className="result-icon"/>
                                                        <h4>Análisis Completado</h4>
                                                    </div>
                                                    <div className="emotion-summary">
                                                        <span>Emoción dominante:</span>
                                                        <div
                                                            className="emotion-badge"
                                                            style={{backgroundColor: getEmotionColor(hasAnalysis.dominant_emotion!)}}
                                                        >
                                                            {hasAnalysis.dominant_emotion} ({hasAnalysis.dominant_percentage?.toFixed(1)}%)
                                                        </div>
                                                    </div>
                                                    <div className="analysis-stats">
                                                        <div className="stat">
                                                            <span className="stat-label">Detecciones:</span>
                                                            <span
                                                                className="stat-value">{hasAnalysis.total_detections}</span>
                                                        </div>
                                                        <div className="stat">
                                                            <span className="stat-label">Confianza:</span>
                                                            <span
                                                                className="stat-value">{(hasAnalysis.avg_confidence! * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="stat">
                                                            <span className="stat-label">Duración:</span>
                                                            <span
                                                                className="stat-value">{hasAnalysis.analysis_duration}s</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="no-questions">
                                        <p>No hay preguntas aún. Crea la primera pregunta.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isPatient && (
                        <div className="patient-panel">
                            {currentQuestion ? (
                                <div className="patient-question">
                                    <h3>
                                        <MessageSquare className="section-icon"/>
                                        Pregunta del Terapeuta
                                    </h3>
                                    <div className="question-card">
                                        <div className="question-text">{currentQuestion.text}</div>
                                        <div className="question-meta">
                                            Pregunta {currentQuestionIndex + 1} de {questions.length}
                                        </div>
                                        <div className="question-navigation">
                                            <button
                                                onClick={handlePreviousQuestion}
                                                disabled={currentQuestionIndex === 0}
                                                className="nav-button"
                                            >
                                                <ChevronLeft className="button-icon"/>
                                            </button>
                                            <button
                                                onClick={handleNextQuestion}
                                                disabled={currentQuestionIndex >= questions.length - 1 || !canProceedToNext}
                                                className="nav-button"
                                                title={!canProceedToNext ? 'Completa el análisis emocional para continuar' : ''}
                                            >
                                                <ChevronRight className="button-icon"/>
                                            </button>
                                        </div>
                                    </div>

                                    {!hasAnalysis && !isAnalyzingEmotion && (
                                        <div className="patient-response">
                                            <label htmlFor="patientResponse">Tu respuesta (opcional):</label>
                                            <textarea
                                                id="patientResponse"
                                                value={patientResponse}
                                                onChange={(e) => setPatientResponse(e.target.value)}
                                                placeholder="Puedes escribir tu respuesta aquí..."
                                                rows={3}
                                                className="response-textarea"
                                            />
                                        </div>
                                    )}

                                    {isAnalyzingEmotion && (
                                        <div className="analysis-notice">
                                            <div className="analysis-indicator">
                                                <div className="pulse-dot"></div>
                                                <span>Análisis emocional en curso...</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill"
                                                    style={{width: `${analysisProgress}%`}}
                                                ></div>
                                            </div>
                                            <p className="analysis-instruction">Mantén tu rostro visible en la
                                                cámara</p>
                                        </div>
                                    )}

                                    {hasAnalysis && (
                                        <div className="analysis-completed">
                                            <div className="completed-header">
                                                <CheckCircle className="completed-icon"/>
                                                <h4>Análisis Completado</h4>
                                            </div>
                                            <div className="emotion-result">
                                                <span>Emoción predominante:</span>
                                                <div
                                                    className="emotion-badge"
                                                    style={{backgroundColor: getEmotionColor(hasAnalysis.dominant_emotion!)}}
                                                >
                                                    {hasAnalysis.dominant_emotion} ({hasAnalysis.dominant_percentage?.toFixed(1)}%)
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="waiting-state">
                                    <Clock className="waiting-icon"/>
                                    <h3>Esperando pregunta del terapeuta...</h3>
                                    <p>Tu terapeuta está preparando la siguiente pregunta.</p>
                                </div>
                            )}

                            <ContinuousEmotionCapture
                                sessionId={session.id}
                                questionId={currentQuestion?.id || 0}
                                isActive={isAnalyzingEmotion}
                                duration={emotionAnalysisDuration}
                                onAnalysisComplete={handleEmotionAnalysisComplete}
                                onRealtimeEmotion={(emotionData) => {
                                    if (connectionStatus === 'connected') {
                                        socket?.emit('real_time_emotion', {
                                            session_code: session.session_code,
                                            emotion: emotionData.emotion,
                                            confidence: emotionData.confidence,
                                        });
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {isTherapist && (
                <div className="session-footer">
                    <div className="session-notes">
                        <h3>Notas de la Sesión</h3>
                        <textarea
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="Agrega notas sobre la sesión..."
                            disabled={session.status === 'completed'}
                            rows={3}
                            className="notes-textarea"
                        />
                    </div>

                    {session.status !== 'completed' && (
                        <div className="session-actions">
                            <button
                                onClick={handleCompleteSession}
                                disabled={loading || questions.length === 0 || connectionStatus !== 'connected'}
                                className="complete-button"
                            >
                                {loading ? (
                                    <>
                                        <div className="button-spinner"></div>
                                        Completando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="button-icon"/>
                                        Completar Sesión
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SessionRoom;
