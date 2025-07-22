import { useState, useEffect } from 'react';
import type { User, AuthContextType } from './types';
import { AuthContext } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import TherapistDashboard from './components/TherapistDashboard';
import PatientDashboard from './components/PatientDashboard';
import { Loader2, Brain, Heart } from 'lucide-react';

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'login' | 'register'>('login');

    useEffect(() => {
        // Check if user is already logged in
        const token = localStorage.getItem('therapy_token');
        const userData = localStorage.getItem('therapy_user');

        if (token && userData) {
            try {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
            } catch (error) {
                console.error('Error parsing user data:', error);
                localStorage.removeItem('therapy_token');
                localStorage.removeItem('therapy_user');
            }
        }
        setLoading(false);
    }, []);

    const login = (userData: User, token: string) => {
        localStorage.setItem('therapy_token', token);
        localStorage.setItem('therapy_user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('therapy_token');
        localStorage.removeItem('therapy_user');
        setUser(null);
    };

    const authContextValue: AuthContextType = {
        user,
        login,
        logout,
        token: localStorage.getItem('therapy_token')
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Brain className="brain-icon" />
                        <Loader2 className="spinner" />
                    </div>
                    <h2>Cargando TherapyMeet</h2>
                    <p>Preparando tu experiencia terapéutica...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <AuthContext.Provider value={authContextValue}>
                <div className="app">
                    <div className="auth-container">
                        <div className="auth-background">
                            <div className="floating-shapes">
                                <div className="shape shape-1"></div>
                                <div className="shape shape-2"></div>
                                <div className="shape shape-3"></div>
                            </div>
                        </div>

                        <div className="auth-content">
                            <div className="auth-header">
                                <div className="logo">
                                    <Brain className="logo-icon" />
                                    <span className="logo-text">TherapyMeet</span>
                                </div>
                                <h1>Plataforma de Terapia con IA</h1>
                                <p>Sesiones terapéuticas con análisis emocional en tiempo real</p>
                            </div>

                            <div className="auth-card">
                                <div className="auth-tabs">
                                    <button
                                        className={`tab-button ${currentView === 'login' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('login')}
                                    >
                                        Iniciar Sesión
                                    </button>
                                    <button
                                        className={`tab-button ${currentView === 'register' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('register')}
                                    >
                                        Registrarse
                                    </button>
                                </div>

                                <div className="auth-form-container">
                                    {currentView === 'login' ? (
                                        <Login onSwitchToRegister={() => setCurrentView('register')} />
                                    ) : (
                                        <Register onSwitchToLogin={() => setCurrentView('login')} />
                                    )}
                                </div>
                            </div>

                            <div className="auth-features">
                                <div className="feature">
                                    <Heart className="feature-icon" />
                                    <span>Análisis emocional en tiempo real</span>
                                </div>
                                <div className="feature">
                                    <Brain className="feature-icon" />
                                    <span>Sesiones seguras y privadas</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={authContextValue}>
            <div className="app">
                {user.role === 'therapist' ? (
                    <TherapistDashboard />
                ) : (
                    <PatientDashboard />
                )}
            </div>
        </AuthContext.Provider>
    );
}

export default App;