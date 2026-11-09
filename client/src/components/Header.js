import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';
import logo from './arkiv.svg';

const PAGES = [
    { to: '/explore', label: 'explore' },
    { to: '/upload', label: 'upload' },
];

const Header = () => {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const navRef = useRef(null);

    const current = PAGES.find((p) => pathname.startsWith(p.to)) || PAGES[0];
    const others = PAGES.filter((p) => p !== current);

    // Close the menu on navigation, outside click, or Escape
    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => navRef.current && !navRef.current.contains(e.target) && setOpen(false);
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <header className="header">
            <h1 className="header-logo">
                <Link to="/">
                    <img src={logo} alt="arkiv" />
                </Link>
            </h1>

            <nav className="nav" aria-label="Main" ref={navRef}>
                <button
                    type="button"
                    className="nav-current"
                    aria-expanded={open}
                    aria-controls="nav-menu"
                    onClick={() => setOpen((o) => !o)}
                >
                    {current.label}
                </button>
                {open && (
                    <ul id="nav-menu" className="nav-menu">
                        {others.map((p) => (
                            <li key={p.to}>
                                <span className="nav-sep" aria-hidden="true" />
                                <Link to={p.to} className="nav-link">{p.label}</Link>
                            </li>
                        ))}
                    </ul>
                )}
            </nav>

            <Link to="/upload" className="nav-plus" aria-label="upload"><span className="nav-plus-icon" aria-hidden="true" /></Link>
        </header>
    );
};

export default Header;
