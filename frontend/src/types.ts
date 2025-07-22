export interface User {
    id: number
    username: string
    email: string
    role: "therapist" | "patient"
    created_at: string
}

export interface Session {
    id: number
    therapist_id: number
    patient_id?: number
    session_code: string
    status: "waiting" | "active" | "completed"
    date_created: string
    date_started?: string
    date_completed?: string
    notes?: string
    therapist?: string
    patient?: string
    questions?: Question[]
}

export interface Question {
    id: number
    session_id: number
    text: string
    order_num: number
    timestamp: string
    response?: Response
    emotion_analysis?: EmotionAnalysis
}

export interface Response {
    id: number
    question_id: number
    emotion: string
    confidence: number
    patient_response?: string
    emotion_data?: any
    timestamp: string
}

export interface EmotionAnalysis {
    id: number
    question_id: number
    dominant_emotion?: string
    dominant_percentage?: number
    avg_confidence?: number
    total_detections: number
    emotion_counts?: Record<string, number>
    analysis_duration?: number
    patient_response?: string
    timestamp: string
}

export interface EmotionResult {
    detected: boolean
    emotion?: string
    confidence?: number
    all_emotions?: Record<string, number>
    face_coordinates?: {
        x: number
        y: number
        width: number
        height: number
    }
    error?: string
    message?: string
}

export interface AuthContextType {
    user: User | null
    login: (user: User, token: string) => void
    logout: () => void
    token: string | null
}
