
"use client"
import type React from "react"
import { useRef, useEffect, useState } from "react"
import { emotionAPI } from "../utils/api"

interface ContinuousEmotionCaptureProps {
    sessionId: number
    questionId: number
    isActive: boolean
    duration: number
    onAnalysisComplete: (analysisData: any) => void
    onRealtimeEmotion?: (emotionData: { emotion: string; confidence: number }) => void
}

const ContinuousEmotionCapture: React.FC<ContinuousEmotionCaptureProps> = ({

    questionId,
    isActive,
    duration,
    onAnalysisComplete,
    onRealtimeEmotion,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    // @ts-ignore
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    // @ts-ignore
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [emotionsData, setEmotionsData] = useState<any[]>([])
    const [currentEmotion, setCurrentEmotion] = useState<string>("")
    const [currentConfidence, setCurrentConfidence] = useState<number>(0)
    const [isCapturing, setIsCapturing] = useState(false)
    const [error, setError] = useState<string>("")
    const [progress, setProgress] = useState<number>(0)

    useEffect(() => {
        console.log('ContinuousEmotionCapture useEffect:', { isActive, questionId, duration });
        if (isActive && questionId > 0) {
            startCapture()
        } else {
            stopCapture()
        }

        return () => {
            cleanup()
        }
    }, [isActive, questionId, duration]) // Agregar duration como dependencia

    const startCapture = async () => {
        try {
            console.log("🎯 Iniciando captura de emociones con duración:", duration);
            setError("")
            setEmotionsData([])
            setProgress(0)
            setIsCapturing(true)

            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                },
                audio: false,
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            // Start emotion detection interval
            let captureCount = 0
            const totalCaptures = duration // One capture per second
            const capturedEmotions: any[] = []

            intervalRef.current = setInterval(async () => {
                try {
                    console.log('Capturando frame:', { captureCount, totalCaptures });
                    const emotionData = await captureFrame()
                    if (emotionData) {
                        capturedEmotions.push({
                            emotion: emotionData.emotion,
                            confidence: emotionData.confidence,
                            timestamp: new Date().toISOString(),
                        })

                        setCurrentEmotion(emotionData.emotion)
                        setCurrentConfidence(emotionData.confidence)

                        // Send real-time emotion to therapist
                        onRealtimeEmotion?.(emotionData)
                    }

                    captureCount++
                    setProgress((captureCount / totalCaptures) * 100)

                    if (captureCount >= totalCaptures) {
                        completeAnalysis(capturedEmotions)
                    }
                } catch (error) {
                    console.error("Error capturando frame:", error)
                }
            }, 1000) // Capture every second

            // Auto-stop after duration
            timeoutRef.current = setTimeout(() => {
                console.log('Finalizando captura por timeout:', duration);
                completeAnalysis(capturedEmotions)
            }, duration * 1000)
        } catch (error: any) {
            console.error("Error iniciando captura:", error)
            setError("Error al acceder a la cámara: " + error.message)
            setIsCapturing(false)
        }
    }

    const captureFrame = async (): Promise<{ emotion: string; confidence: number } | null> => {
        if (!videoRef.current || !canvasRef.current) return null

        try {
            const canvas = canvasRef.current
            const context = canvas.getContext("2d")
            if (!context) return null

            // Set canvas size to match video
            canvas.width = videoRef.current.videoWidth || 640
            canvas.height = videoRef.current.videoHeight || 480

            // Draw current video frame to canvas
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

            // Convert canvas to base64 image
            const imageData = canvas.toDataURL("image/jpeg", 0.8)

            // Send to emotion detection API
            console.log('Enviando frame a emotionAPI.detectEmotion');
            const response = await emotionAPI.detectEmotion(imageData)

            if (response.emotion && response.confidence !== undefined) {
                console.log('Emoción detectada:', response);
                return {
                    emotion: response.emotion,
                    confidence: response.confidence,
                }
            }

            return null
        } catch (error) {
            console.error("Error capturando frame:", error)
            return null
        }
    }

    const completeAnalysis = (capturedEmotions: any[]) => {
        console.log("✅ Completando análisis emocional con", capturedEmotions.length, "capturas");

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }

        setIsCapturing(false)
        setProgress(100)

        // Process captured emotions
        const analysisData = {
            emotions_data: capturedEmotions,
            total_captures: capturedEmotions.length,
            duration: duration,
        }

        setEmotionsData(capturedEmotions)
        onAnalysisComplete(analysisData)

        // Stop video stream
        stopCapture()
    }

    const stopCapture = () => {
        console.log("⏹️ Deteniendo captura de emociones...")

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        setIsCapturing(false)
        setProgress(0)
    }

    const cleanup = () => {
        stopCapture()
    }

    return (
        <div className="continuous-emotion-capture">
            {isActive && (
                <div className="emotion-capture-container">
                    <div className="capture-header">
                        <h4>🎭 Captura de Emociones</h4>
                        {isCapturing && (
                            <div className="capture-progress">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="progress-text">{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>

                    <div className="video-container">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="emotion-video"
                            style={{
                                width: "320px",
                                height: "240px",
                                borderRadius: "8px",
                                border: "2px solid #ddd",
                            }}
                        />
                        <canvas ref={canvasRef} style={{ display: "none" }} width={640} height={480} />
                    </div>

                    {currentEmotion && isCapturing && (
                        <div className="current-emotion-display">
                            <div className="emotion-info">
                                <span className="emotion-label">Emoción actual:</span>
                                <div className="emotion-badge" style={{ backgroundColor: getEmotionColor(currentEmotion) }}>
                                    {currentEmotion} ({(currentConfidence * 100).toFixed(1)}%)
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="capture-error">
                            <span>❌ {error}</span>
                        </div>
                    )}

                    {!isCapturing && emotionsData.length > 0 && (
                        <div className="analysis-summary">
                            <h5>📊 Resumen del Análisis</h5>
                            <p>Capturas realizadas: {emotionsData.length}</p>
                            <p>Duración: {duration} segundos</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
        Happy: "#f1c40f",
        Sad: "#3498db",
        Angry: "#e74c3c",
        Fear: "#9b59b6",
        Surprise: "#f39c12",
        Disgust: "#27ae60",
        Neutral: "#95a5a6",
    }
    return colors[emotion] || "#bdc3c7"
}

export default ContinuousEmotionCapture
