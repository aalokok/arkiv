import React from 'react';
import { Link } from 'react-router-dom';
import logo from './arkiv.svg';
import './Landing.css';

// One slow, giant line of the label drifting across the panel. The track holds the text twice,
// so sliding it by half its width loops without a seam.
const Marquee = ({ text }) => {
    const run = Array.from({ length: 4 }, () => text).join(' ');
    return (
        <span className="landing-marquee" aria-hidden="true">
            <span className="landing-marquee-track">
                <span>{run}</span>
                <span>{run}</span>
            </span>
        </span>
    );
};

// On hover: the arkiv wordmark (a mask, so it takes the half's type colour) next to the half's word.
const Lockup = ({ word }) => (
    <span className="landing-lockup">
        <span className="landing-lockup-logo" style={{ '--logo': `url(${logo})` }} />
        <span className="landing-lockup-word">{word}</span>
    </span>
);

/* Two flat halves with the arkiv logo over the seam. At rest each shows its word drifting past;
   on hover the half swaps its two colours, the line fades and the word appears small in its place. */
const Landing = () => (
    <main className="landing">

        <Link to="/upload" className="landing-panel landing-upload" aria-label="upload a photo">
            <Marquee text="upload" />
            <Lockup word="upload" />
        </Link>

        <Link to="/explore" className="landing-panel landing-explore" aria-label="explore the globe">
            <Marquee text="explore" />
            <Lockup word="explore" />
        </Link>

        {/* the arkiv logo over the seam (a mask, so CSS sets its colour) */}
        <h1 className="landing-logo" style={{ '--logo': `url(${logo})` }}>
            <span className="visually-hidden">arkiv</span>
        </h1>
    </main>
);

export default Landing;
