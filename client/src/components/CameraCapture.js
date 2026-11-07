import React, { useEffect, useRef, useState } from 'react';

// Webcam capture for laptops/desktops. (Phones use the native camera via
// <input capture>, which is handled in UploadForm.) Resolves a JPEG File via onCapture.
const CameraCapture = ({ onCapture, onClose }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then((stream) => {
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            })
            .catch(() => setError("We couldn't open your camera. Check the browser's camera permission, or choose a file instead."));

        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => {
            cancelled = true;
            document.removeEventListener('keydown', onKey);
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [onClose]);

    const capture = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(
            (blob) => blob && onCapture(new File([blob], `arkiv-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })),
            'image/jpeg',
            0.9
        );
    };

    return (
        <div className="upload-modal" role="dialog" aria-modal="true" aria-label="Take a photo">
            <div className="upload-modal-card">
                {error ? (
                    <p className="upload-error">{error}</p>
                ) : (
                    <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
                )}
                <div className="upload-modal-actions">
                    <button type="button" className="upload-link" onClick={onClose}>cancel</button>
                    {!error && (
                        <button type="button" className="upload-button" onClick={capture}>
                            take photo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CameraCapture;
