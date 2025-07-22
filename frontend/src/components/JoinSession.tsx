import React, { useState } from 'react';
import { ArrowLeft, Link, HelpCircle, CheckCircle, Camera, Mic } from 'lucide-react';

interface JoinSessionProps {
    onJoinSession: (sessionCode: string) => void;
    onBack: () => void;
}

const JoinSession: React.FC<JoinSessionProps> = ({ onJoinSession, onBack }) => {
    const [sessionCode, setSessionCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionCode.trim()) {
            setError('Por favor ingresa un código de sesión');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onJoinSession(sessionCode.trim().toUpperCase());
        } catch (error: any) {
            setError(error.message || 'Error al unirse a la sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="join-session">
            <div className="join-session-container">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft className="button-icon" />
                    Volver
                </button>

                <div className="join-session-content">
                    <div className="join-header">
                        <div className="join-icon">
                            <Link className="icon" />
                        </div>
                        <h2>Unirse a Sesión</h2>
                        <p>Ingresa el código proporcionado por tu terapeuta</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="error-close">×</button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="join-form">
                        <div className="form-group">
                            <label htmlFor="sessionCode">Código de Sesión</label>
                            <input
                                type="text"
                                id="sessionCode"
                                value={sessionCode}
                                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                                placeholder="Ej: ABC12345"
                                maxLength={10}
                                disabled={loading}
                                className="session-code-input"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !sessionCode.trim()}
                            className="join-button"
                        >
                            {loading ? (
                                <>
                                    <div className="button-spinner"></div>
                                    Uniéndose...
                                </>
                            ) : (
                                <>
                                    <Link className="button-icon" />
                                    Unirse a la Sesión
                                </>
                            )}
                        </button>
                    </form>

                    <div className="join-help">
                        <div className="help-header">
                            <HelpCircle className="help-icon" />
                            <h3>Antes de unirte</h3>
                        </div>

                        <div className="help-checklist">
                            <div className="help-item">
                                <CheckCircle className="check-icon" />
                                <span>Asegúrate de tener el código correcto de tu terapeuta</span>
                            </div>
                            <div className="help-item">
                                <Camera className="check-icon" />
                                <span>Permite el acceso a tu cámara para el análisis emocional</span>
                            </div>
                            <div className="help-item">
                                <Mic className="check-icon" />
                                <span>Permite el acceso a tu micrófono para la comunicación</span>
                            </div>
                        </div>

                        <div className="help-note">
                            <p>Si tienes problemas para unirte, contacta a tu terapeuta para verificar el código.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinSession;