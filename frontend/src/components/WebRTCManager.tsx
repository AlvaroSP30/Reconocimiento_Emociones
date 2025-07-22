"use client"
import type React from "react"
import { useRef, useEffect, useState } from "react"
import type { Socket } from "socket.io-client"

interface WebRTCManagerProps {
    sessionCode: string
    userRole: "therapist" | "patient"
    socket: Socket | null
    isTherapist: boolean
}

const WebRTCManager: React.FC<WebRTCManagerProps> = ({ sessionCode, userRole, socket, isTherapist }) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
    const [isAudioEnabled, setIsAudioEnabled] = useState(true)
    const [isVideoEnabled, setIsVideoEnabled] = useState(true)
    const [connectionState, setConnectionState] = useState<string>("new")
    const [isInitialized, setIsInitialized] = useState(false)

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

    // Improved WebRTC configuration for better remote connectivity
    const rtcConfiguration = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            // Add more STUN servers for better connectivity
            { urls: "stun:stun.services.mozilla.com" },
            { urls: "stun:stun.stunprotocol.org:3478" },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle" as RTCBundlePolicy,
        rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
    }

    useEffect(() => {
        initializeMedia()
        return () => {
            cleanup()
        }
    }, [])

    useEffect(() => {
        if (socket && !isInitialized) {
            setupSocketListeners()
            setIsInitialized(true)
        }
    }, [socket, isInitialized])

    const setupSocketListeners = () => {
        if (!socket) return

        socket.on("webrtc_offer", handleReceiveOffer)
        socket.on("webrtc_answer", handleReceiveAnswer)
        socket.on("webrtc_ice_candidate", handleReceiveIceCandidate)

        return () => {
            socket.off("webrtc_offer")
            socket.off("webrtc_answer")
            socket.off("webrtc_ice_candidate")
        }
    }

    const initializeMedia = async () => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user",
                    frameRate: { ideal: 30 },
                },
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            setLocalStream(stream)

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }

            // Setup peer connection after getting media
            setupPeerConnection(stream)
        } catch (error) {
            console.error("Error accessing media devices:", error)
        }
    }

    const setupPeerConnection = (stream: MediaStream) => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
        }

        const peerConnection = new RTCPeerConnection(rtcConfiguration)
        peerConnectionRef.current = peerConnection

        // Add local stream tracks
        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream)
        })

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log("Received remote stream")
            const [remoteStream] = event.streams
            setRemoteStream(remoteStream)
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream
            }
        }

        // Handle ICE candidates with better error handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log("Sending ICE candidate:", event.candidate)
                socket.emit("webrtc_ice_candidate", {
                    session_code: sessionCode,
                    candidate: event.candidate,
                })
            }
        }

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log("Connection state:", peerConnection.connectionState)
            setConnectionState(peerConnection.connectionState)

            // Auto-retry connection if failed
            if (peerConnection.connectionState === "failed") {
                console.log("Connection failed, attempting to restart ICE")
                peerConnection.restartIce()
            }
        }

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection state:", peerConnection.iceConnectionState)

            if (peerConnection.iceConnectionState === "disconnected") {
                console.log("ICE disconnected, attempting to reconnect")
                // Attempt to restart ICE gathering
                setTimeout(() => {
                    if (peerConnection.iceConnectionState === "disconnected") {
                        peerConnection.restartIce()
                    }
                }, 3000)
            }
        }

        // Auto-start call for therapist with delay
        if (isTherapist) {
            setTimeout(() => {
                createOffer()
            }, 3000) // Wait 3 seconds for both users to be ready
        }
    }

    const createOffer = async () => {
        if (!peerConnectionRef.current || !socket) return

        try {
            console.log("Creating offer...")
            const offer = await peerConnectionRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            })

            await peerConnectionRef.current.setLocalDescription(offer)

            socket.emit("webrtc_offer", {
                session_code: sessionCode,
                offer: offer,
            })
        } catch (error) {
            console.error("Error creating offer:", error)
        }
    }

    const handleReceiveOffer = async (data: any) => {
        if (!peerConnectionRef.current || !socket) return

        try {
            console.log("Received offer")
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))

            const answer = await peerConnectionRef.current.createAnswer()
            await peerConnectionRef.current.setLocalDescription(answer)

            socket.emit("webrtc_answer", {
                session_code: sessionCode,
                answer: answer,
            })
        } catch (error) {
            console.error("Error handling offer:", error)
        }
    }

    const handleReceiveAnswer = async (data: any) => {
        if (!peerConnectionRef.current) return

        try {
            console.log("Received answer")
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        } catch (error) {
            console.error("Error handling answer:", error)
        }
    }

    const handleReceiveIceCandidate = async (data: any) => {
        if (!peerConnectionRef.current) return

        try {
            console.log("Received ICE candidate:", data.candidate)
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (error) {
            console.error("Error adding ICE candidate:", error)
        }
    }

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsAudioEnabled(audioTrack.enabled)
            }
        }
    }

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsVideoEnabled(videoTrack.enabled)
            }
        }
    }

    const startCall = () => {
        createOffer()
    }

    const cleanup = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop())
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
        }
    }

    return (
        <div className="webrtc-manager">
            <div className="video-grid">
                {/* Local Video */}
                <div className="video-container local">
                    <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
                    <div className="video-label">{userRole === "therapist" ? "Terapeuta (Tú)" : "Paciente (Tú)"}</div>
                    {!isVideoEnabled && <div className="video-disabled">📷 Cámara desactivada</div>}
                </div>

                {/* Remote Video */}
                <div className="video-container remote">
                    <video ref={remoteVideoRef} autoPlay playsInline className="video-element" />
                    <div className="video-label">{userRole === "therapist" ? "Paciente" : "Terapeuta"}</div>
                    {!remoteStream && <div className="video-placeholder">👤 Esperando conexión...</div>}
                </div>
            </div>

            {/* Controls */}
            <div className="webrtc-controls">
                <button
                    className={`control-button ${isAudioEnabled ? "enabled" : "disabled"}`}
                    onClick={toggleAudio}
                    title={isAudioEnabled ? "Silenciar micrófono" : "Activar micrófono"}
                >
                    {isAudioEnabled ? "🎤" : "🔇"}
                </button>

                <button
                    className={`control-button ${isVideoEnabled ? "enabled" : "disabled"}`}
                    onClick={toggleVideo}
                    title={isVideoEnabled ? "Desactivar cámara" : "Activar cámara"}
                >
                    {isVideoEnabled ? "📹" : "📷"}
                </button>

                {isTherapist && (connectionState === "new" || connectionState === "disconnected") && (
                    <button className="control-button start-call" onClick={startCall} title="Iniciar llamada">
                        📞 {connectionState === "disconnected" ? "Reconectar" : "Iniciar"}
                    </button>
                )}

                <div className="connection-status">
          <span className={`status-indicator ${connectionState}`}>
            {connectionState === "connected"
                ? "🟢"
                : connectionState === "connecting"
                    ? "🟡"
                    : connectionState === "disconnected"
                        ? "🟠"
                        : "🔴"}
          </span>
                    <span className="status-text">
            {connectionState === "connected"
                ? "Conectado"
                : connectionState === "connecting"
                    ? "Conectando..."
                    : connectionState === "disconnected"
                        ? "Desconectado"
                        : "Sin conexión"}
          </span>
                </div>
            </div>
        </div>
    )
}

export default WebRTCManager
