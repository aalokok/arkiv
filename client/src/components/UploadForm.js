import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './UploadForm.css';
import CameraCapture from './CameraCapture';
import LocationPicker, { countryForPoint } from './LocationPicker';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/digb5lz1t/image/upload';
const CLOUDINARY_PRESET = 'archive';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // Cloudinary's free-plan limit
const PHONE_QUERY = '(max-width: 760px)';

const EMPTY_FORM = { name: '', yourName: '', caption: '', date: '', location: null };

// Phones/tablets open the native camera through <input capture>; desktops get the webcam modal.
const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const canUseWebcam = () => Boolean(navigator.mediaDevices?.getUserMedia);

const useIsPhone = () => {
    const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
    useEffect(() => {
        const mq = window.matchMedia(PHONE_QUERY);
        const onChange = () => setIsPhone(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return isPhone;
};

const ImageAddIcon = () => (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M40 12H14a6 6 0 0 0-6 6v32a6 6 0 0 0 6 6h32a6 6 0 0 0 6-6V30" />
        <path d="M8 44l12-12 22 22" />
        <path d="M36 44l6-6 10 10" />
        <path d="M52 4v16M44 12h16" />
    </svg>
);

async function uploadToCloudinary(file) {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', CLOUDINARY_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secure_url) throw new Error('image');
    return data.secure_url;
}

const UploadForm = ({ onMarkerAdded }) => {
    const isPhone = useIsPhone();
    const [step, setStep] = useState(1); // phone only: 1 = photo & details, 2 = location
    const [form, setForm] = useState(EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [dragging, setDragging] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle'); // idle | uploading | saving | done | failed
    const [failure, setFailure] = useState('');

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    useEffect(() => {
        if (!imageFile) { setPreview(''); return undefined; }
        const url = URL.createObjectURL(imageFile);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    const clearError = (key) => setErrors((prev) => ({ ...prev, [key]: undefined }));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        clearError(name);
    };

    const acceptFile = useCallback((file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors((prev) => ({ ...prev, image: 'that file isn’t an image' }));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setErrors((prev) => ({ ...prev, image: 'images need to be under 10 mb' }));
            return;
        }
        setImageFile(file);
        setErrors((prev) => ({ ...prev, image: undefined }));
    }, []);

    const takePhoto = () => {
        if (isTouchDevice() || !canUseWebcam()) cameraInputRef.current?.click();
        else setCameraOpen(true);
    };
    const closeCamera = useCallback(() => setCameraOpen(false), []);
    const onCaptured = useCallback((file) => { setCameraOpen(false); acceptFile(file); }, [acceptFile]);

    const setLocation = useCallback((point) => {
        setForm((prev) => ({ ...prev, location: point }));
        setErrors((prev) => ({ ...prev, location: undefined }));
    }, []);

    const detailErrors = () => {
        const next = {};
        if (!imageFile) next.image = 'add a photo';
        if (!form.name.trim()) next.name = 'add a name';
        if (!form.yourName.trim()) next.yourName = 'add your name';
        if (!form.caption.trim()) next.caption = 'add a caption';
        if (!form.date) next.date = 'pick a date';
        return next;
    };

    const goToLocation = () => {
        const next = detailErrors();
        setErrors(next);
        if (Object.keys(next).length === 0) setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (status === 'uploading' || status === 'saving') return; // no double submits

        const next = detailErrors();
        if (!form.location) next.location = 'drop a pin on the globe';
        setErrors(next);
        if (Object.keys(next).length) {
            if (isPhone && Object.keys(next).some((k) => k !== 'location')) setStep(1);
            return;
        }

        setFailure('');
        try {
            setStatus('uploading');
            const [image, country] = await Promise.all([
                uploadToCloudinary(imageFile),
                countryForPoint(form.location),
            ]);

            setStatus('saving');
            const res = await fetch('/api/markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: form.name.trim(),      // shown as the title on the globe
                    photographer: form.yourName.trim(), // shown as "by" on the globe
                    story: form.caption.trim(),
                    date: form.date,
                    location: form.location,
                    country,
                    image,
                    usage: 'open',
                }),
            });
            if (!res.ok) throw new Error('save');

            setStatus('done');
            onMarkerAdded?.();
        } catch (err) {
            setStatus('failed');
            setFailure(err.message === 'save'
                ? 'the photo uploaded but saving failed — try again'
                : 'the photo couldn’t upload — check your connection and try again');
        }
    };

    const startOver = () => {
        setForm(EMPTY_FORM);
        setImageFile(null);
        setErrors({});
        setStatus('idle');
        setStep(1);
    };

    const busy = status === 'uploading' || status === 'saving';
    const showDetails = !isPhone || step === 1;
    const showGlobe = !isPhone || step === 2;

    if (status === 'done') {
        return (
            <main className="upload-page upload-page--done">
                <div className="upload-done">
                    <p className="upload-done-title">uploaded</p>
                    <p className="upload-done-text">your photo is on the globe</p>
                    <div className="upload-actions">
                        <Link to="/explore" className="upload-button">see it</Link>
                        <button type="button" className="upload-link" onClick={startOver}>upload another</button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="upload-page">
            <form className="upload-layout" onSubmit={handleSubmit} noValidate>
                {showDetails && (
                    <section className="upload-details">
                        {isPhone && <p className="upload-step">1 / 2 · photo & details</p>}

                        <div
                            className={'upload-drop' + (dragging ? ' is-dragging' : '') + (preview ? ' has-image' : '')}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files[0]); }}
                        >
                            <button type="button" className="upload-drop-target"
                                    onClick={() => fileInputRef.current?.click()}
                                    aria-label={preview ? 'change photo' : 'choose a photo'}>
                                {preview
                                    ? <img src={preview} alt="your photo" className="upload-preview" />
                                    : <span className="upload-drop-icon"><ImageAddIcon /></span>}
                            </button>
                            <div className="upload-drop-actions">
                                <span>{preview ? 'click to change, or' : 'drag, click, or'}</span>
                                <button type="button" className="upload-link" onClick={takePhoto}>take a photo</button>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" hidden
                                   onChange={(e) => { acceptFile(e.target.files[0]); e.target.value = ''; }} />
                            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
                                   onChange={(e) => { acceptFile(e.target.files[0]); e.target.value = ''; }} />
                        </div>
                        {errors.image && <p className="upload-error">{errors.image}</p>}

                        <label className="upload-field">
                            <span className="upload-label">name</span>
                            <input name="name" value={form.name} onChange={handleChange}
                                   placeholder="what is this photo?" aria-invalid={!!errors.name} />
                        </label>
                        {errors.name && <p className="upload-error">{errors.name}</p>}

                        <label className="upload-field">
                            <span className="upload-label">your name</span>
                            <input name="yourName" value={form.yourName} onChange={handleChange}
                                   placeholder="who took or shared it" autoComplete="name"
                                   aria-invalid={!!errors.yourName} />
                        </label>
                        {errors.yourName && <p className="upload-error">{errors.yourName}</p>}

                        <label className="upload-field">
                            <span className="upload-label">caption</span>
                            <textarea name="caption" value={form.caption} onChange={handleChange} rows={3}
                                      placeholder="the story behind it" aria-invalid={!!errors.caption} />
                        </label>
                        {errors.caption && <p className="upload-error">{errors.caption}</p>}

                        <label className="upload-field">
                            <span className="upload-label">date</span>
                            <input type="date" name="date" value={form.date} onChange={handleChange}
                                   className={form.date ? '' : 'is-empty'} aria-invalid={!!errors.date} />
                        </label>
                        {errors.date && <p className="upload-error">{errors.date}</p>}

                        {isPhone ? (
                            <div className="upload-actions">
                                <button type="button" className="upload-button" onClick={goToLocation}>next</button>
                            </div>
                        ) : (
                            <SubmitRow busy={busy} status={status} failure={failure} errors={errors} />
                        )}
                    </section>
                )}

                {showGlobe && (
                    <section className="upload-location">
                        {isPhone && <p className="upload-step">2 / 2 · where was it taken?</p>}
                        <LocationPicker value={form.location} onChange={setLocation} />
                        {errors.location && <p className="upload-error">{errors.location}</p>}
                        {isPhone && (
                            <div className="upload-actions upload-actions--split">
                                <button type="button" className="upload-link" onClick={() => setStep(1)}>back</button>
                                <SubmitRow busy={busy} status={status} failure={failure} errors={errors} />
                            </div>
                        )}
                    </section>
                )}
            </form>

            {cameraOpen && <CameraCapture onCapture={onCaptured} onClose={closeCamera} />}
        </main>
    );
};

const SubmitRow = ({ busy, status, failure, errors }) => (
    <div className="upload-submit-row">
        <button type="submit" className={'upload-button' + (busy ? ' is-busy' : '')} disabled={busy}>
            {status === 'uploading' ? 'uploading…' : status === 'saving' ? 'saving…' : 'upload'}
        </button>
        <p className="upload-status" role="status">
            {status === 'failed' && failure}
            {status === 'idle' && Object.values(errors).some(Boolean) && 'a few things need fixing'}
        </p>
    </div>
);

export default UploadForm;
