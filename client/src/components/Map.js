import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import './Map.css';
import { applyBrandToMap, getToken, setMapLabels } from '../styles/mapTheme';
import { useLocation } from 'react-router-dom';
import InfoPanel from './InfoPanel';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// "2024-05-01" → "1 May 2024"; anything unparseable is shown as stored
const formatDate = (value) => {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const line = (a, b) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [a.geometry.coordinates, b.geometry.coordinates] },
    properties: {},
});

// Lines between related photos.
//  - 'date':   every pair of photos taken on the same day
//  - 'author': each person's photos ("your name"), joined in date order like a trail
export function buildConnections(markers, mode) {
    const empty = { type: 'FeatureCollection', features: [] };
    if (!markers?.features) return empty;

    const groups = {};
    markers.features.forEach((m) => {
        const raw = mode === 'author' ? m.properties.photographer : m.properties.date;
        const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (!key) return; // no author / no date: nothing to connect
        (groups[key] = groups[key] || []).push(m);
    });

    const features = [];
    Object.values(groups).forEach((group) => {
        if (group.length < 2) return;
        if (mode === 'author') {
            const trail = [...group].sort((a, b) => String(a.properties.date).localeCompare(String(b.properties.date)));
            for (let i = 0; i < trail.length - 1; i++) features.push(line(trail[i], trail[i + 1]));
        } else {
            for (let i = 0; i < group.length - 1; i++) {
                for (let j = i + 1; j < group.length; j++) features.push(line(group[i], group[j]));
            }
        }
    });
    return { type: 'FeatureCollection', features };
}

// Photos linked to `props` under the current "connect by" mode, in date order (itself included).
const keyFor = (props, mode) => {
    const raw = mode === 'author' ? props.photographer : props.date;
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
};

export function relatedPhotos(geojson, props, mode) {
    const key = keyFor(props, mode);
    if (!key || !geojson?.features) return [];
    return geojson.features
        .filter((f) => keyFor(f.properties, mode) === key)
        .sort((a, b) => String(a.properties.date).localeCompare(String(b.properties.date)));
}

const isPhoneWidth = () => window.matchMedia('(max-width: 700px)').matches;


const Map = ({ geojsonData, isLoading }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [selected, setSelected] = useState(null); // { props, coords } of the opened dot
    const infoOnArrival = new URLSearchParams(useLocation().search).has('info');
    const popupData = selected?.props || null;
    const [dotPoint, setDotPoint] = useState(null); // screen position of the opened dot
    const [cardAnchor, setCardAnchor] = useState(null); // where the connector meets the card
    const cardRef = useRef(null);
    const openMarkerRef = useRef(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const popupOpenRef = useRef(false);
    const hoveringMarkerRef = useRef(false); // pointer over a dot: hold the spin so it can be clicked
    const [hoverName, setHoverName] = useState(null); // { name, x, y } of the dot under the pointer
    const spinRef = useRef(null);
    const styleReadyMapRef = useRef(null); // the map instance whose style has finished loading

    const [connectBy, setConnectBy] = useState('date'); // 'date' | 'author'
    const connectByRef = useRef(connectBy);
    connectByRef.current = connectBy;
    const [showLabels, setShowLabels] = useState(false); // country / city names on the globe, off by default
    const [browseRecent, setBrowseRecent] = useState(false); // card arrows step through every dot, newest upload first
    const showLabelsRef = useRef(showLabels);
    showLabelsRef.current = showLabels;

    // Initialize the map immediately; markers are added once data arrives
    useEffect(() => {
        let resumeTimer;
        if (!mapInstance.current) {
            mapInstance.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/aalokok/cm469v2sd00r701qr9jr47x3i',
                center: [0, 0],
                zoom: 1.5,
                projection: 'globe',
                attributionControl: false, // replaced by the compact (ⓘ) version below
            });
            mapInstance.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

            const createdForStyle = mapInstance.current;
            createdForStyle.on('style.load', () => {
                applyBrandToMap(createdForStyle);
                setMapLabels(createdForStyle, showLabelsRef.current);
                styleReadyMapRef.current = createdForStyle;
                setMapInitialized(true);
            });

            // Slow idle spin. Pauses while the user drags/zooms or has a marker panel open.
            const map = mapInstance.current;
            const SECONDS_PER_REVOLUTION = 180;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let userInteracting = false;

            const spin = () => {
                if (reduceMotion || userInteracting || popupOpenRef.current || hoveringMarkerRef.current || map.getZoom() > 3) return;
                const center = map.getCenter();
                center.lng -= 360 / SECONDS_PER_REVOLUTION;
                map.easeTo({ center, duration: 1000, easing: (n) => n });
            };
            const pause = () => {
                userInteracting = true;
                clearTimeout(resumeTimer);
            };
            const resume = () => { userInteracting = false; spin(); };
            // Zoom gestures arrive as many small steps; a spin step started on their moveend
            // would cancel the zoom, so wait until the user has been still for a moment.
            const resumeSoon = () => {
                clearTimeout(resumeTimer);
                resumeTimer = setTimeout(resume, 1200);
            };
            const isUserEvent = (e) => Boolean(e.originalEvent);

            // A press halts the current spin step at once so the globe doesn't slide under the
            // pointer. Only presses do this: calling stop() on wheel/zoom would cancel the zoom itself.
            const pressPause = () => { pause(); map.stop(); };
            map.on('mousedown', pressPause);
            map.on('touchstart', pressPause);
            map.on('mouseup', resumeSoon);
            map.on('touchend', resumeSoon);
            map.on('dragend', resumeSoon);
            map.on('wheel', () => { pause(); resumeSoon(); });
            map.on('zoomstart', (e) => isUserEvent(e) && pause());
            map.on('zoomend', (e) => isUserEvent(e) && resumeSoon());
            map.on('moveend', spin); // each step queues the next
            map.on('load', spin);
            spinRef.current = spin;
        }

        const createdMap = mapInstance.current;
        return () => {
            clearTimeout(resumeTimer);
            createdMap.remove();
            mapInstance.current = null;
            setMapInitialized(false);
        };
    }, []);

    // Open a dot: glide the globe so the dot sits beside the card, then show the card
    const openMarker = useCallback((props, coords) => {
        const map = mapInstance.current;
        setSelected({ props, coords });
        setHoverName(null);
        if (!map) return;
        const phone = isPhoneWidth();
        map.stop();
        map.flyTo({
            center: coords,
            zoom: Math.max(map.getZoom(), 2.2),
            // desktop: dot left of centre, card on the right; phone: dot in the upper part, sheet below
            offset: phone ? [0, -window.innerHeight * 0.22] : [-window.innerWidth * 0.18, 0],
            duration: 900,
            essential: true,
        });
    }, []);
    openMarkerRef.current = openMarker;

    // Keep the connector's dot end on the dot while the globe moves
    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !selected) { setDotPoint(null); return undefined; }
        const update = () => {
            const p = map.project(selected.coords);
            setDotPoint({ x: p.x, y: p.y });
        };
        update();
        map.on('move', update);
        return () => map.off('move', update);
    }, [selected]);

    // Where the connector meets the card: its left edge (desktop) or top edge (phone sheet)
    useEffect(() => {
        if (!selected) { setCardAnchor(null); return undefined; }
        const measure = () => {
            const r = cardRef.current?.getBoundingClientRect();
            if (!r) return;
            setCardAnchor(isPhoneWidth()
                ? { x: r.left + r.width / 2, y: r.top }
                : { x: r.left, y: r.top + Math.min(r.height / 2, 160) });
        };
        measure();
        const settle = setTimeout(measure, 400); // again once the card's slide-in animation has finished
        const ro = new ResizeObserver(measure);
        if (cardRef.current) ro.observe(cardRef.current);
        window.addEventListener('resize', measure);
        return () => { clearTimeout(settle); ro.disconnect(); window.removeEventListener('resize', measure); };
    }, [selected]);

    // The card's photo frame takes the photo's own proportions (width / height), set once it loads
    const [photoRatio, setPhotoRatio] = useState(4 / 3);
    useEffect(() => { setPhotoRatio(4 / 3); }, [selected?.props?.image]);

    // Full-screen photo viewer (opened from the card's photo)
    const [viewerOpen, setViewerOpen] = useState(false);
    const swipeStartX = useRef(null);
    useEffect(() => { if (!selected) setViewerOpen(false); }, [selected]);

    // Every dot, newest upload first (for "recent")
    const recentOrder = useMemo(
        () => [...(geojsonData?.features || [])].sort((a, b) =>
            String(b.properties.created || '').localeCompare(String(a.properties.created || ''))),
        [geojsonData]
    );

    // What the card's arrows step through: every dot by recency in "recent" mode,
    // otherwise the photos linked to the open one under the current filter
    const related = useMemo(() => {
        if (!selected) return [];
        return browseRecent ? recentOrder : relatedPhotos(geojsonData, selected.props, connectBy);
    }, [geojsonData, selected, connectBy, browseRecent, recentOrder]);
    const stepLabel = browseRecent ? 'recent' : 'same ' + (connectBy === 'author' ? 'author' : 'day');

    // "recent" ends when the card closes
    useEffect(() => { if (!selected) setBrowseRecent(false); }, [selected]);

    // Toggle "recent": on opens the newest upload, off returns the arrows to linked photos
    const toggleRecent = () => {
        if (browseRecent) { setBrowseRecent(false); return; }
        const newest = recentOrder[0];
        if (!newest) return;
        setBrowseRecent(true);
        openMarker(newest.properties, newest.geometry.coordinates);
    };
    // Mapbox returns clicked positions slightly rounded, so match on the image URL (unique per
    // upload), falling back to name + date + approximate position.
    const relatedIndex = related.findIndex((f) => {
        if (!selected) return false;
        const a = f.properties;
        const b = selected.props;
        if (a.image && b.image) return a.image === b.image;
        const [x, y] = f.geometry.coordinates;
        return a.owner === b.owner && a.date === b.date
            && Math.abs(x - selected.coords[0]) < 1e-3 && Math.abs(y - selected.coords[1]) < 1e-3;
    });
    const canStep = related.length > 1 && relatedIndex >= 0;
    const step = (dir) => {
        if (!canStep) return;
        const next = related[(relatedIndex + dir + related.length) % related.length];
        openMarker(next.properties, next.geometry.coordinates);
    };
    const stepRef = useRef(step);
    stepRef.current = step;

    // Escape closes the viewer first, then the card; arrow keys step while the viewer is open
    useEffect(() => {
        if (!selected) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (viewerOpen) setViewerOpen(false);
                else setSelected(null);
            } else if (viewerOpen && e.key === 'ArrowRight') stepRef.current(1);
            else if (viewerOpen && e.key === 'ArrowLeft') stepRef.current(-1);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selected, viewerOpen]);

    // Pause the spin while a marker's card is open; resume when it closes
    useEffect(() => {
        popupOpenRef.current = Boolean(popupData);
        if (!popupData) spinRef.current?.();
    }, [popupData]);

    // Add sources and layers once map is initialized and data is loaded
    useEffect(() => {
        if (!mapInitialized || !geojsonData || isLoading) return;
        // A freshly re-created map (e.g. after a dev hot reload) may not have its style yet;
        // its 'style.load' handler marks it ready and sets mapInitialized, so this re-runs then.
        if (!mapInstance.current || styleReadyMapRef.current !== mapInstance.current) return;

        // Add sources and layers
        if (!mapInstance.current.getSource('markers')) {
            // Connector lines: thin, light, brand periwinkle
            mapInstance.current.addSource('connections', {
                type: 'geojson',
                data: buildConnections(geojsonData, connectByRef.current)
            });

            mapInstance.current.addLayer({
                id: 'connection-layer',
                type: 'line',
                source: 'connections',
                layout: { 'line-cap': 'round' },
                paint: {
                    'line-color': getToken('--color-connection', '#B3C0FF'),
                    'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 1.2, 10, 1.5],
                    'line-opacity': 0.7
                }
            });

            // Add markers source and layer
            mapInstance.current.addSource('markers', {
                type: 'geojson',
                data: geojsonData
            });

            mapInstance.current.addLayer({
                id: 'marker-layer',
                type: 'circle',
                source: 'markers',
                paint: {
                    'circle-radius': 8,
                    'circle-color': getToken('--color-marker', '#FFC5B3'),
                }
            });

            // Add click handlers
            mapInstance.current.on('click', 'marker-layer', (e) => {
                const f = e.features[0];
                openMarkerRef.current?.(f.properties, f.geometry.coordinates);
            });

            // clicking empty globe closes the card
            mapInstance.current.on('click', (e) => {
                const hit = mapInstance.current.queryRenderedFeatures(e.point, { layers: ['marker-layer'] });
                if (!hit.length) setSelected(null);
            });

            mapInstance.current.on('mouseenter', 'marker-layer', () => {
                mapInstance.current.getCanvas().style.cursor = 'pointer';
                hoveringMarkerRef.current = true;
                // freeze the spin while a dot is under the pointer, but never interrupt a zoom
                // in progress (dots slide under the pointer while scrolling)
                if (!mapInstance.current.isZooming()) mapInstance.current.stop();
            });

            // Hover preview: just the photo's name next to the dot. mousemove (not only
            // mouseenter) so sliding between neighbouring dots updates the name.
            mapInstance.current.on('mousemove', 'marker-layer', (e) => {
                const feature = e.features?.[0];
                const name = feature?.properties?.owner;
                if (!name) { setHoverName(null); return; }
                const point = mapInstance.current.project(feature.geometry.coordinates);
                setHoverName({ name, x: point.x, y: point.y });
            });

            mapInstance.current.on('mouseleave', 'marker-layer', () => {
                mapInstance.current.getCanvas().style.cursor = '';
                hoveringMarkerRef.current = false;
                setHoverName(null);
                spinRef.current?.();
            });

            // the side panel takes over once a dot is clicked
            mapInstance.current.on('click', 'marker-layer', () => setHoverName(null));
        } else {
            // Update existing sources with new data
            const markerSource = mapInstance.current.getSource('markers');
            const connectionSource = mapInstance.current.getSource('connections');

            if (markerSource && connectionSource) {
                markerSource.setData(geojsonData);
                connectionSource.setData(buildConnections(geojsonData, connectByRef.current));
            }
        }
    }, [geojsonData, mapInitialized, isLoading]);

    // Redraw the connector lines when the "connect by" filter changes
    useEffect(() => {
        const source = mapInstance.current?.getSource?.('connections');
        if (source && geojsonData) source.setData(buildConnections(geojsonData, connectBy));
    }, [connectBy, geojsonData]);

    // Show / hide the place names when the toggle changes
    useEffect(() => {
        if (styleReadyMapRef.current) setMapLabels(styleReadyMapRef.current, showLabels);
    }, [showLabels]);

    return (
        <div>
            {/* gray dot grid behind the globe */}
            <div className="explore-dots" aria-hidden="true" />
            {/* information: round "i" bottom left; /explore?info opens it on arrival */}
            <InfoPanel startOpen={infoOnArrival} closeSignal={selected} />
            {/* bottom right: one column, so the button row and the connect-by filter are always the same width */}
            <div className="map-controls">
            {/* browse by recent, and the place-names toggle */}
            <div className="map-toggles">
                <button
                    type="button"
                    className={'map-toggle' + (browseRecent ? ' is-on' : '')}
                    aria-pressed={browseRecent}
                    onClick={toggleRecent}
                >
                    recent
                </button>
                <button
                    type="button"
                    className={'map-toggle' + (showLabels ? ' is-on' : '')}
                    aria-pressed={showLabels}
                    onClick={() => setShowLabels((v) => !v)}
                >
                    labels
                </button>
            </div>
            {/* connect-by filter (above the Mapbox ⓘ) */}
            <div className="connect-filter" role="group" aria-label="Connect photos by">
                <span className="connect-filter-label">connect by</span>
                {/* date ◧ author: a switch between the two; either word also picks its side */}
                <button
                    type="button"
                    className={'connect-filter-option' + (connectBy === 'date' ? ' is-active' : '')}
                    onClick={() => setConnectBy('date')}
                    tabIndex={-1}
                    aria-hidden="true"
                >
                    date
                </button>
                <button
                    type="button"
                    role="switch"
                    aria-checked={connectBy === 'author'}
                    aria-label="connect by author (off: by date)"
                    className={'connect-switch' + (connectBy === 'author' ? ' is-author' : '')}
                    onClick={() => setConnectBy((m) => (m === 'author' ? 'date' : 'author'))}
                >
                    <span className="connect-switch-knob" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={'connect-filter-option' + (connectBy === 'author' ? ' is-active' : '')}
                    onClick={() => setConnectBy('author')}
                    tabIndex={-1}
                    aria-hidden="true"
                >
                    author
                </button>
            </div>
            </div>

            {hoverName && !popupData && (
                // React escapes the text, so user-submitted names can't inject markup
                <div
                    className={'marker-tooltip' + (hoverName.x > window.innerWidth - 290 ? ' is-left' : '')}
                    style={{ left: hoverName.x, top: hoverName.y }}
                    aria-hidden="true"
                >
                    {hoverName.name}
                </div>
            )}
            <div ref={mapContainer} id="map" className="explore-map-container">
                {isLoading && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        padding: '20px',
                        borderRadius: '5px',
                        zIndex: 1000
                    }}>
                        Loading map data...
                    </div>
                )}
            </div>

            {selected && (
                <>
                    {/* periwinkle line from the dot to the card, plus a ring on the chosen dot */}
                    {dotPoint && cardAnchor && (
                        <svg className="marker-card-link" aria-hidden="true">
                            <line x1={dotPoint.x} y1={dotPoint.y} x2={cardAnchor.x} y2={cardAnchor.y} />
                        </svg>
                    )}
                    {dotPoint && (
                        <span className="marker-card-ring" style={{ left: dotPoint.x, top: dotPoint.y }} aria-hidden="true" />
                    )}

                    <article className="marker-card" ref={cardRef} aria-label={popupData.owner || 'photo'}>
                        <button type="button" className="marker-card-close card-square" onClick={() => setSelected(null)} aria-label="close">
                            <span className="card-square-icon is-cross" aria-hidden="true" />
                        </button>

                        {popupData.image && (
                            <button
                                type="button"
                                className="marker-card-photo"
                                style={{ '--photo-ratio': photoRatio }}
                                onClick={() => setViewerOpen(true)}
                                aria-label="view photo and full caption"
                            >
                                <img
                                    src={popupData.image}
                                    alt={popupData.owner || 'uploaded photo'}
                                    className="marker-card-image"
                                    onLoad={(e) => {
                                        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                                        if (w && h) setPhotoRatio(w / h);
                                    }}
                                />
                            </button>
                        )}

                        <div className="marker-card-body">
                            <h3 className="marker-card-title">{popupData.owner}</h3>
                            <p className="marker-card-meta">
                                {[popupData.photographer && 'by ' + popupData.photographer, formatDate(popupData.date), popupData.country]
                                    .filter(Boolean).join(' · ')}
                            </p>
                            {popupData.story && <p className="marker-card-caption">{popupData.story}</p>}
                        </div>

                        {/* bottom row: linked-photo arrows on the left (when there are any), + to open full size on the right */}
                        <div className="marker-card-foot">
                            {canStep && (
                                <nav className="marker-card-nav" aria-label={browseRecent ? 'all photos, newest first' : 'photos linked by ' + connectBy}>
                                    <button type="button" className="marker-card-step" onClick={() => step(-1)} aria-label="previous linked photo">‹</button>
                                    <span className="marker-card-count">{relatedIndex + 1} of {related.length} · {stepLabel}</span>
                                    <button type="button" className="marker-card-step" onClick={() => step(1)} aria-label="next linked photo">›</button>
                                </nav>
                            )}
                            {popupData.image && (
                                <button type="button" className="marker-card-expand card-square" onClick={() => setViewerOpen(true)}
                                        aria-label="open full size">
                                    <span className="card-square-icon" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </article>

                    {/* full-screen view: big photo plus the full caption */}
                    {viewerOpen && popupData.image && (
                        <div
                            className="photo-viewer"
                            role="dialog"
                            aria-modal="true"
                            aria-label={popupData.owner || 'photo'}
                            onClick={(e) => e.target === e.currentTarget && setViewerOpen(false)}
                            onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
                            onTouchEnd={(e) => {
                                if (swipeStartX.current == null) return;
                                const dx = e.changedTouches[0].clientX - swipeStartX.current;
                                swipeStartX.current = null;
                                if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
                            }}
                        >
                            <button type="button" className="photo-viewer-close card-square" onClick={() => setViewerOpen(false)} aria-label="close">
                                <span className="card-square-icon is-cross" aria-hidden="true" />
                            </button>
                            <div className="photo-viewer-stage" onClick={(e) => e.target === e.currentTarget && setViewerOpen(false)}>
                                <img
                                    key={popupData.image}
                                    src={popupData.image}
                                    alt={popupData.owner || 'uploaded photo'}
                                    className="photo-viewer-image"
                                />
                            </div>
                            <aside className="photo-viewer-info">
                                <h3 className="photo-viewer-title">{popupData.owner}</h3>
                                <p className="marker-card-meta">
                                    {[popupData.photographer && 'by ' + popupData.photographer, formatDate(popupData.date), popupData.country]
                                        .filter(Boolean).join(' · ')}
                                </p>
                                {popupData.story && <p className="photo-viewer-caption">{popupData.story}</p>}
                                {canStep && (
                                    <nav className="marker-card-nav" aria-label={browseRecent ? 'all photos, newest first' : 'photos linked by ' + connectBy}>
                                        <button type="button" className="marker-card-step" onClick={() => step(-1)} aria-label="previous photo">‹</button>
                                        <span className="marker-card-count">{relatedIndex + 1} of {related.length} · {stepLabel}</span>
                                        <button type="button" className="marker-card-step" onClick={() => step(1)} aria-label="next photo">›</button>
                                    </nav>
                                )}
                            </aside>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Map;