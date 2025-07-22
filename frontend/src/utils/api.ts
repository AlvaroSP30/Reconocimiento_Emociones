const API_BASE_URL = "https://902d6842e03e.ngrok-free.app/api"

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("therapy_token")
    const config: RequestInit = {
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`)
        }

        return data
    } catch (error) {
        console.error("API request failed:", error)
        throw error
    }
}

// Auth API calls
export const authAPI = {
    register: (userData: any) =>
        apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify(userData),
        }),
    login: (credentials: any) =>
        apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        }),
    getProfile: () => apiRequest("/auth/profile"),
    updateProfile: (userData: any) =>
        apiRequest("/auth/profile", {
            method: "PUT",
            body: JSON.stringify(userData),
        }),
}

// Sessions API calls
export const sessionsAPI = {
    createSession: (sessionData: any) =>
        apiRequest("/sessions", {
            method: "POST",
            body: JSON.stringify(sessionData),
        }),
    getSessions: () => apiRequest("/sessions"),
    getSession: (sessionId: number) => apiRequest(`/sessions/${sessionId}`),
    joinSession: (sessionCode: string) =>
        apiRequest(`/sessions/join/${sessionCode}`, {
            method: "POST",
        }),
    addQuestion: (sessionId: number, questionData: any) =>
        apiRequest(`/sessions/${sessionId}/questions`, {
            method: "POST",
            body: JSON.stringify(questionData),
        }),
    completeSession: (sessionId: number, notes?: string) =>
        apiRequest(`/sessions/${sessionId}/complete`, {
            method: "PUT",
            body: JSON.stringify({ notes }),
        }),
    getSessionDashboard: (sessionId: number) => apiRequest(`/sessions/${sessionId}/dashboard`),
    canProceedToNextQuestion: (sessionId: number, questionId: number) =>
        apiRequest(`/sessions/${sessionId}/questions/${questionId}/can-proceed`),
}

// Emotion detection API calls
export const emotionAPI = {
    detectEmotion: (imageData: string) =>
        apiRequest("/detect-emotion", {
            method: "POST",
            body: JSON.stringify({ image: imageData }),
        }),
    detectEmotionAndSave: (sessionId: number, questionId: number, imageData: string, patientResponse?: string) =>
        apiRequest("/detect-emotion-and-save", {
            method: "POST",
            body: JSON.stringify({
                session_id: sessionId,
                question_id: questionId,
                image: imageData,
                patient_response: patientResponse || "",
            }),
        }),
    getEmotionSummary: (sessionId: number) => apiRequest(`/sessions/${sessionId}/emotion-summary`),
}

// Real-time API calls
export const realtimeAPI = {
    saveContinuousEmotion: (
        sessionId: number,
        questionId: number,
        analysisData: any,
        patientResponse: string,
        duration: number,
    ) =>
        apiRequest("/realtime/continuous-emotion", {
            method: "POST",
            body: JSON.stringify({
                session_id: sessionId,
                question_id: questionId,
                emotions_data: analysisData.emotions_data,
                patient_response: patientResponse,
                duration: duration,
            }),
        }),
    getEmotionTimeline: (sessionId: number) => apiRequest(`/realtime/session/${sessionId}/emotion-timeline`),
    getQuestionAnalysis: (questionId: number) => apiRequest(`/realtime/question/${questionId}/analysis`),
}
