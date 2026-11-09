import React, { useEffect, useRef, useState } from 'react';
import './InfoPanel.css';
import logo from './arkiv.svg';

const PORTFOLIO_URL = 'https://www.aalok.space/?view=creative-technology';
const REPO_URL = 'https://github.com/aalokok/arkiv';

const External = ({ href, children }) => (
    <a className="info-link" href={href} target="_blank" rel="noopener noreferrer">
        {children}<span aria-hidden="true"> ↗</span>
    </a>
);

/* Information lives on Explore: a round "i" at the bottom left opens a small soft popup.
   `startOpen` opens it on arrival (links to /explore?info); `closeSignal` closes it when it
   changes (Explore passes the opened dot, so the photo card and the popup never overlap). */
const InfoPanel = ({ startOpen = false, closeSignal }) => {
    const [open, setOpen] = useState(startOpen);
    const rootRef = useRef(null);

    useEffect(() => { if (closeSignal) setOpen(false); }, [closeSignal]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, [open]);

    return (
        <div className="info" ref={rootRef}>
            {open && (
                <section id="info-popup" className="info-popup" aria-label="about arkiv">
                    <p className="info-sentence">
                        <span className="info-logo" style={{ '--logo': `url(${logo})` }} role="img" aria-label="arkiv" />{' '}
                        lets anyone pin a photo to the globe with a name, a caption and the day it was taken.
                        each one becomes a dot, linked by thin lines to photos from the same day or by the same person.
                    </p>
                    <p className="info-privacy">
                        everything you add when you upload (the photo, both names, the caption, the date and the pin)
                        is shown publicly on the globe.
                    </p>
                    <p className="info-credit">
                        made by aalok sud
                        <span className="info-links">
                            <External href={PORTFOLIO_URL}>portfolio</External>
                            <External href={REPO_URL}>github</External>
                        </span>
                    </p>
                </section>
            )}
            <button
                type="button"
                className={'info-toggle' + (open ? ' is-open' : '')}
                aria-expanded={open}
                aria-controls="info-popup"
                onClick={() => setOpen((o) => !o)}
            >
                information
                <span className="info-toggle-mark" aria-hidden="true">{open ? '×' : '+'}</span>
            </button>
        </div>
    );
};

export default InfoPanel;
