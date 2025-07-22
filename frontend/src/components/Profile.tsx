"use client"

import type React from "react"
import { useState, useContext, useEffect } from "react"
import { AuthContext } from "../context/AuthContext"
import { authAPI } from "../utils/api"
import { User, Mail, Lock, Save, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react"

interface ProfileProps {
    onBack: () => void
}

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
    const authContext = useContext(AuthContext)
    const [formData, setFormData] = useState({
        username: authContext?.user?.username || "",
        email: authContext?.user?.email || "",
        password: "",
        confirmPassword: "",
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        if (authContext?.user) {
            setFormData({
                username: authContext.user.username,
                email: authContext.user.email,
                password: "",
                confirmPassword: "",
            })
        }
    }, [authContext?.user])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
        // Clear messages when user starts typing
        if (error) setError("")
        if (success) setSuccess("")
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess("")

        // Validation
        if (formData.username.length < 3) {
            setError("El nombre de usuario debe tener al menos 3 caracteres")
            setLoading(false)
            return
        }

        if (!formData.email.includes("@")) {
            setError("Por favor ingresa un email válido")
            setLoading(false)
            return
        }

        if (formData.password && formData.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres")
            setLoading(false)
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Las contraseñas no coinciden")
            setLoading(false)
            return
        }

        try {
            // Prepare update data
            const updateData: any = {
                username: formData.username,
                email: formData.email,
            }

            // Only include password if it's being changed
            if (formData.password) {
                updateData.password = formData.password
            }

            const response = await authAPI.updateProfile(updateData)

            // Update auth context with new user data
            if (authContext?.user && authContext.token) {
                authContext.login(response.user, authContext.token)
            }

            setSuccess("Perfil actualizado exitosamente")
            setIsEditing(false)

            // Clear password fields
            setFormData({
                ...formData,
                password: "",
                confirmPassword: "",
            })
        } catch (error: any) {
            setError(error.message || "Error al actualizar el perfil")
        } finally {
            setLoading(false)
        }
    }

    const getRoleDisplayName = (role: string) => {
        return role === "therapist" ? "Terapeuta" : "Paciente"
    }

    const getRoleIcon = (role: string) => {
        return role === "therapist" ? "👨‍⚕️" : "👤"
    }

    if (!authContext?.user) {
        return (
            <div className="profile-error">
                <p>Error: No se pudo cargar la información del usuario</p>
                <button onClick={onBack} className="back-button">
                    <ArrowLeft className="button-icon" />
                    Volver
                </button>
            </div>
        )
    }

    return (
        <div className="profile-container">
            <header className="profile-header">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft className="button-icon" />
                    Volver
                </button>
                <div className="header-info">
                    <div className="user-avatar large">{authContext.user.username.charAt(0).toUpperCase()}</div>
                    <div className="user-details">
                        <h1>{authContext.user.username}</h1>
                        <div className="user-role">
                            <span className="role-icon">{getRoleIcon(authContext.user.role)}</span>
                            <span className="role-text">{getRoleDisplayName(authContext.user.role)}</span>
                        </div>
                        <p className="member-since">
                            Miembro desde{" "}
                            {new Date(authContext.user.created_at).toLocaleDateString("es-ES", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                </div>
            </header>

            <div className="profile-content">
                {error && (
                    <div className="error-message">
                        <AlertCircle className="error-icon" />
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="error-close">
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        <CheckCircle className="success-icon" />
                        <span>{success}</span>
                        <button onClick={() => setSuccess("")} className="success-close">
                            ×
                        </button>
                    </div>
                )}

                <div className="profile-card">
                    <div className="card-header">
                        <h2>Información Personal</h2>
                        {!isEditing && (
                            <button className="edit-button" onClick={() => setIsEditing(true)}>
                                Editar Perfil
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="profile-form">
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
                                disabled={loading || !isEditing}
                                minLength={3}
                                className={!isEditing ? "disabled" : ""}
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
                                disabled={loading || !isEditing}
                                className={!isEditing ? "disabled" : ""}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="role">
                                <User className="input-icon" />
                                Tipo de usuario
                            </label>
                            <input
                                type="text"
                                id="role"
                                value={getRoleDisplayName(authContext.user.role)}
                                disabled
                                className="disabled"
                            />
                            <small className="form-help">El tipo de usuario no se puede cambiar</small>
                        </div>

                        {isEditing && (
                            <>
                                <div className="password-section">
                                    <h3>Cambiar Contraseña (Opcional)</h3>
                                    <div className="form-group">
                                        <label htmlFor="password">
                                            <Lock className="input-icon" />
                                            Nueva contraseña
                                        </label>
                                        <input
                                            type="password"
                                            id="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="••••••••"
                                            disabled={loading}
                                            minLength={6}
                                        />
                                        <small className="form-help">Deja en blanco si no quieres cambiar la contraseña</small>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">
                                            <Lock className="input-icon" />
                                            Confirmar nueva contraseña
                                        </label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            placeholder="••••••••"
                                            disabled={loading}
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="cancel-button"
                                        onClick={() => {
                                            setIsEditing(false)
                                            setFormData({
                                                username: authContext.user?.username || "",
                                                email: authContext.user?.email || "",
                                                password: "",
                                                confirmPassword: "",
                                            })
                                            setError("")
                                            setSuccess("")
                                        }}
                                        disabled={loading}
                                    >
                                        Cancelar
                                    </button>
                                    <button type="submit" className="save-button" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <div className="button-spinner"></div>
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="button-icon" />
                                                Guardar Cambios
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>

                <div className="profile-stats">
                    <h3>Estadísticas</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-value">ID: {authContext.user.id}</div>
                            <div className="stat-label">Identificador único</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{new Date(authContext.user.created_at).toLocaleDateString("es-ES")}</div>
                            <div className="stat-label">Fecha de registro</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Profile
