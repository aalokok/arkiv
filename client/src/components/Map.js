import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import './Map.css';
import { applyBrandToMap, getToken } from '../styles/mapTheme';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// "2024-05-01" → "1 May 2024"; anything unparseable is shown as stored
const formatDate = (value) => {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const Map = ({ geojsonData, isLoading }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [popupData, setPopupData] = useState(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const popupOpenRef = useRef(false);
    const hoveringMarkerRef = useRef(false); // pointer over a dot: hold the spin so it can be clicked
    const [hoverName, setHoverName] = useState(null); // { name, x, y } of the dot under the pointer
    const spinRef = useRef(null);
    const styleReadyMapRef = useRef(null); // the map instance whose style has finished loading

    const createDateConnections = (markers) => {
        if (!markers || !markers.features) return { type: 'FeatureCollection', features: [] };

        // Group markers by date
        const markersByDate = {};
        markers.features.forEach(marker => {
            const date = marker.properties.date;
            if (!markersByDate[date]) {
                markersByDate[date] = [];
            }
            markersByDate[date].push(marker);
        });

        // Create lines between markers with the same date
        const connections = {
            type: 'FeatureCollection',
            features: []
        };

        Object.values(markersByDate).forEach(dateMarkers => {
            if (dateMarkers.length >= 2) {
                for (let i = 0; i < dateMarkers.length - 1; i++) {
                    for (let j = i + 1; j < dateMarkers.length; j++) {
                        connections.features.push({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    dateMarkers[i].geometry.coordinates,
                                    dateMarkers[j].geometry.coordinates
                                ]
                            },
                            properties: {
                                date: dateMarkers[i].properties.date
                            }
                        });
                    }
                }
            }
        });

        return connections;
    };

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

    // Pause the spin while a marker's side panel is open; resume when it closes
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
            // Add glow effect source and layer
            mapInstance.current.addSource('connections-glow', {
                type: 'geojson',
                data: createDateConnections(geojsonData)
            });

            mapInstance.current.addLayer({
                id: 'connection-glow',
                type: 'line',
                source: 'connections-glow',
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 4,
                    'line-opacity': 0.2,
                    'line-blur': 3
                }
            });

            // Add connections source and layer
            mapInstance.current.addSource('connections', {
                type: 'geojson',
                data: createDateConnections(geojsonData)
            });

            mapInstance.current.addLayer({
                id: 'connection-layer',
                type: 'line',
                source: 'connections',
                paint: {
                    'line-color': ['interpolate', ['linear'], ['zoom'],
                        0, '#000000',
                        5, '#000000',
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'],
                        0, 1,
                        5, 2,
                        10, 3
                    ],
                    'line-opacity': 0.8
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
                    'circle-stroke-width': 2,
                    'circle-stroke-color': getToken('--color-marker-stroke', '#ffffff')
                }
            });

            // Add click handlers
            mapInstance.current.on('click', 'marker-layer', (e) => {
                const properties = e.features[0].properties;
                setPopupData(properties);
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
            const glowSource = mapInstance.current.getSource('connections-glow');

            if (markerSource && connectionSource && glowSource) {
                markerSource.setData(geojsonData);
                const connections = createDateConnections(geojsonData);
                connectionSource.setData(connections);
                glowSource.setData(connections);
            }
        }
    }, [geojsonData, mapInitialized, isLoading]);

    return (
        <div>
            {/* gray dot grid behind the globe */}
            <div className="explore-dots" aria-hidden="true" />
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

            {popupData && (
                <div className="popup-side-panel">
                    <button className="close-button" onClick={() => setPopupData(null)}>
                        &times;
                    </button>
                    {/* same fields as the upload form: photo, name, your name, caption, date (+ country from the pin) */}
                    <div className="popup-details">
                        {popupData.image && (
                            <img
                                src={popupData.image}
                                alt={popupData.owner || 'uploaded photo'}
                                className="popup-image"
                            />
                        )}
                        <h3>{popupData.owner}</h3>
                        {popupData.photographer && (
                            <div className="popup-field">
                                <span className="popup-label">by</span>
                                <p>{popupData.photographer}</p>
                            </div>
                        )}
                        {popupData.story && (
                            <div className="popup-field">
                                <span className="popup-label">caption</span>
                                <p>{popupData.story}</p>
                            </div>
                        )}
                        {popupData.date && (
                            <div className="popup-field">
                                <span className="popup-label">date</span>
                                <p>{formatDate(popupData.date)}</p>
                            </div>
                        )}
                        {popupData.country && (
                            <div className="popup-field">
                                <span className="popup-label">location</span>
                                <p>{popupData.country}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;