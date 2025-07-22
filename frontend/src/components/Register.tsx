import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import { User, Mail, Lock, UserPlus, AlertCircle } from 'lucide-react';

interface RegisterProps {
    onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'patient' as 'therapist' | 'patient'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const authContext = useContext(AuthContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.register(formData);
            authContext?.login(response.user, response.access_token);
        } catch (error: any) {
            setError(error.message || 'Error al registrarse');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-form">
            <div className="form-header">
                <UserPlus className="form-icon" />
                <h2>Crear Cuenta</h2>
                <p>Únete a TherapyMeet y comienza tu experiencia</p>
            </div>

            {error && (
                <div className="error-message">
                    <AlertCircle className="error-icon" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label htmlFor="username">
                        <User className="input-icon" />
                        Nombre de usuario
                    </label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Tu nombre de usuario"
                        required
                        disabled={loading}
                        minLength={3}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email">
                        <Mail className="input-icon" />
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
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
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        disabled={loading}
                        minLength={6}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="role">
                        <User className="input-icon" />
                        Tipo de usuario
                    </label>
                    <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    >
                        <option value="patient">👤 Paciente</option>
                        <option value="therapist">👨‍⚕️ Terapeuta</option>
                    </select>
                </div>

                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? (
                        <>
                            <div className="button-spinner"></div>
                            Registrando...
                        </>
                    ) : (
                        <>
                            <UserPlus className="button-icon" />
                            Crear Cuenta
                        </>
                    )}
                </button>
            </form>

            <div className="auth-switch">
                <p>
                    ¿Ya tienes cuenta?{' '}
                    <button
                        type="button"
                        className="link-button"
                        onClick={onSwitchToLogin}
                    >
                        Inicia sesión aquí
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Register;