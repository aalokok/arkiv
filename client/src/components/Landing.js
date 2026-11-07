import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from './arkiv.svg';
import './Landing.css';
import { recolorMapImage } from '../styles/mapTheme';

// Static Mapbox render of Canada in the site's own map style (land recolored to the brand primary).
const CANADA_MAP =
    'https://api.mapbox.com/styles/v1/aalokok/cm469v2sd00r701qr9jr47x3i/static/-96,63,1.55,0/600x520@2x' +
    `?attribution=false&logo=false&access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`;

const UploadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5h.5a4.5 4.5 0 0 1 .5 8.97" />
        <path d="M12 21v-9" />
        <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
    </svg>
);

const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
);

// Huge repeating label rows that scroll sideways; only shown on hover (see Landing.css).
// Each track holds the text twice so translating it by -50% loops seamlessly.
const Marquee = ({ text, rows }) => {
    const run = Array.from({ length: 4 }, () => text).join(' · ') + ' · ';
    return (
        <span className="landing-marquee" aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <span key={i} className={'landing-marquee-row' + (i % 2 ? ' is-reverse' : '')}>
                    <span className="landing-marquee-track">
                        <span>{run}</span>
                        <span>{run}</span>
                    </span>
                </span>
            ))}
        </span>
    );
};

const Landing = () => {
    // Show the map only once it's recolored, so the old style color never flashes
    const [mapSrc, setMapSrc] = useState(null);
    useEffect(() => {
        let alive = true;
        recolorMapImage(CANADA_MAP).then((src) => alive && setMapSrc(src));
        return () => { alive = false; };
    }, []);

    return (
    <main className="landing">
        <Link to="/upload" className="landing-panel landing-upload" aria-label="Upload">
            <Marquee text="upload" rows={3} />
            <span className="landing-icon"><UploadIcon /></span>
        </Link>

        <Link to="/about" className="landing-panel landing-about" aria-label="About arkiv and privacy">
            <Marquee text="about arkiv and privacy" rows={3} />
            <span className="landing-icon"><LockIcon /></span>
        </Link>

        <Link to="/explore" className="landing-panel landing-explore" aria-label="Explore">
            <Marquee text="explore" rows={6} />
            {mapSrc
                ? <img className="landing-icon landing-map" src={mapSrc} alt="" />
                : <span className="landing-icon landing-map" aria-hidden="true" />}
        </Link>

        <h1 className="landing-logo">
            <img src={logo} alt="arkiv" />
        </h1>
    </main>
    );
};

export default Landing;
