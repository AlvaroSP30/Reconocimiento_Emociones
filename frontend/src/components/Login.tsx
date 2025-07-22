import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

interface LoginProps {
    onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const authContext = useContext(AuthContext);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.login({ email, password });
            authContext?.login(response.user, response.access_token);
        } catch (error: any) {
            setError(error.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const fillDemoCredentials = (role: 'therapist' | 'patient') => {
        if (role === 'therapist') {
            setEmail('dr.smith@therapy.com');
            setPassword('therapist123');
        } else {
            setEmail('john@email.com');
            setPassword('patient123');
        }
    };

    return (
        <div className="auth-form">
            <div className="form-header">
                <LogIn className="form-icon" />
                <h2>Iniciar Sesión</h2>
                <p>Accede a tu cuenta de TherapyMeet</p>
            </div>

            {error && (
                <div className="error-message">
                    <AlertCircle className="error-icon" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label htmlFor="email">
                        <Mail className="input-icon" />
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">
                        <Lock className="input-icon" />
                        Contraseña
                    </label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={loading}
                    />
                </div>

                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? (
                        <>
                            <div className="button-spinner"></div>
                            Iniciando sesión...
                        </>
                    ) : (
                        <>
                            <LogIn className="button-icon" />
                            Iniciar Sesión
                        </>
                    )}
                </button>
            </form>

            <div className="demo-accounts">
                <p className="demo-title">Cuentas de prueba:</p>
                <div className="demo-buttons">
                    <button
                        type="button"
                        className="demo-button therapist"
                        onClick={() => fillDemoCredentials('therapist')}
                        disabled={loading}
                    >
                        👨‍⚕️ Terapeuta Demo
                    </button>
                    <button
                        type="button"
                        className="demo-button patient"
                        onClick={() => fillDemoCredentials('patient')}
                        disabled={loading}
                    >
                        👤 Paciente Demo
                    </button>
                </div>
            </div>

            <div className="auth-switch">
                <p>
                    ¿No tienes cuenta?{' '}
                    <button
                        type="button"
                        className="link-button"
                        onClick={onSwitchToRegister}
                    >
                        Regístrate aquí
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Login;