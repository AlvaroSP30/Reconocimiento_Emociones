"use client"

import type React from "react"
import { useState, useEffect, useContext } from "react"
import { AuthContext } from "../context/AuthContext"
import type { Session } from "../types"
import { sessionsAPI } from "../utils/api"
import SessionList from "./SessionList"
import SessionRoom from "./SessionRoom"
import JoinSession from "./JoinSession"
import Profile from "./Profile"
import { Brain, LogOut, Link, Loader2, User } from "lucide-react"

type ViewType = "sessions" | "join" | "room" | "profile"

const PatientDashboard: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentView, setCurrentView] = useState<ViewType>("sessions")
    const [selectedSession, setSelectedSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const authContext = useContext(AuthContext)

    useEffect(() => {
        loadSessions()
    }, [])

    const loadSessions = async () => {
        try {
            setLoading(true)
            const response = await sessionsAPI.getSessions()
            setSessions(response.sessions)
        } catch (error: any) {
            setError(error.message || "Error al cargar sesiones")
        } finally {
            setLoading(false)
        }
    }

    const handleJoinSession = async (sessionCode: string) => {
        try {
            const response = await sessionsAPI.joinSession(sessionCode)
            setSelectedSession(response.session)
            setCurrentView("room")
            loadSessions()
        } catch (error: any) {
            setError(error.message || "Error al unirse a la sesión")
        }
    }

    const handleSelectSession = (session: Session) => {
        setSelectedSession(session)
        setCurrentView("room")
    }

    const handleBackToSessions = () => {
        setCurrentView("sessions")
        setSelectedSession(null)
        loadSessions()
    }

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <Loader2 className="spinner large" />
                    <h2>Cargando sesiones...</h2>
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <div className="logo">
                            <Brain className="logo-icon" />
                            <span className="logo-text">TherapyMeet</span>
                        </div>
                        <h1>Panel del Paciente</h1>
                    </div>
                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-avatar">{authContext?.user?.username.charAt(0).toUpperCase()}</div>
                            <div className="user-details">
                                <span className="user-name">{authContext?.user?.username}</span>
                                <span className="user-role">Paciente</span>
                            </div>
                        </div>
                        <button className="profile-button" onClick={() => setCurrentView("profile")} title="Ver perfil">
                            <User className="button-icon" />
                        </button>
                        <button className="logout-button" onClick={authContext?.logout}>
                            <LogOut className="button-icon" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                {error && (
                    <div className="error-banner">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="error-close">
                            ×
                        </button>
                    </div>
                )}

                {currentView === "sessions" && (
                    <div className="sessions-view">
                        <div className="view-header">
                            <h2>Mis Sesiones</h2>
                            <button className="primary-button" onClick={() => setCurrentView("join")}>
                                <Link className="button-icon" />
                                Unirse a Sesión
                            </button>
                        </div>
                        <SessionList sessions={sessions} onSelectSession={handleSelectSession} userRole="patient" />
                    </div>
                )}

                {currentView === "join" && (
                    <JoinSession onJoinSession={handleJoinSession} onBack={() => setCurrentView("sessions")} />
                )}

                {currentView === "room" && selectedSession && (
                    <SessionRoom session={selectedSession} onBack={handleBackToSessions} />
                )}

                {currentView === "profile" && <Profile onBack={() => setCurrentView("sessions")} />}
            </main>
        </div>
    )
}

export default PatientDashboard
