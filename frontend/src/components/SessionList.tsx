import React from 'react';
import type { Session } from '../types';
import { Calendar, Clock, Users, Play, BarChart3, Circle } from 'lucide-react';

interface SessionListProps {
    sessions: Session[];
    onSelectSession: (session: Session) => void;
    userRole: 'therapist' | 'patient';
}

const SessionList: React.FC<SessionListProps> = ({ sessions, onSelectSession, userRole }) => {
    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'active':
                return { color: '#10b981', text: 'Activa', icon: Circle };
            case 'completed':
                return { color: '#6b7280', text: 'Completada', icon: Circle };
            case 'waiting':
                return { color: '#f59e0b', text: 'Esperando', icon: Circle };
            default:
                return { color: '#6b7280', text: 'Desconocido', icon: Circle };
        }
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

    if (sessions.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">
                    <Calendar className="icon" />
                </div>
                <h3>No hay sesiones disponibles</h3>
                <p>
                    {userRole === 'therapist'
                        ? 'Crea tu primera sesión para comenzar a ayudar a tus pacientes.'
                        : 'Únete a una sesión usando el código proporcionado por tu terapeuta.'}
                </p>
            </div>
        );
    }

    return (
        <div className="session-list">
            <div className="sessions-grid">
                {sessions.map((session) => {
                    const statusInfo = getStatusInfo(session.status);
                    const StatusIcon = statusInfo.icon;

                    return (
                        <div
                            key={session.id}
                            className="session-card"
                            onClick={() => onSelectSession(session)}
                        >
                            <div className="session-header">
                                <div className="session-code">
                                    <span className="code-label">Código</span>
                                    <span className="code-value">{session.session_code}</span>
                                </div>
                                <div className="session-status" style={{ color: statusInfo.color }}>
                                    <StatusIcon className="status-icon" />
                                    <span>{statusInfo.text}</span>
                                </div>
                            </div>

                            <div className="session-body">
                                <div className="participants">
                                    <div className="participant">
                                        <Users className="participant-icon" />
                                        <div className="participant-info">
                                            <span className="participant-label">Terapeuta</span>
                                            <span className="participant-name">{session.therapist || 'No asignado'}</span>
                                        </div>
                                    </div>
                                    <div className="participant">
                                        <Users className="participant-icon" />
                                        <div className="participant-info">
                                            <span className="participant-label">Paciente</span>
                                            <span className="participant-name">{session.patient || 'Esperando...'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="session-dates">
                                    <div className="date-item">
                                        <Calendar className="date-icon" />
                                        <div className="date-info">
                                            <span className="date-label">Creada</span>
                                            <span className="date-value">{formatDate(session.date_created)}</span>
                                        </div>
                                    </div>
                                    {session.date_completed && (
                                        <div className="date-item">
                                            <Clock className="date-icon" />
                                            <div className="date-info">
                                                <span className="date-label">Completada</span>
                                                <span className="date-value">{formatDate(session.date_completed)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {session.notes && (
                                    <div className="session-notes">
                                        <p>{session.notes.length > 100 ? `${session.notes.substring(0, 100)}...` : session.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="session-footer">
                                <button className="session-action-button">
                                    {session.status === 'completed' ? (
                                        <>
                                            <BarChart3 className="button-icon" />
                                            Ver Resultados
                                        </>
                                    ) : (
                                        <>
                                            <Play className="button-icon" />
                                            Entrar a Sesión
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SessionList;