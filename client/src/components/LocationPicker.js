import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { applyBrandToMap, getToken } from '../styles/mapTheme';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// Looks up the country name for a point using Mapbox's reverse geocoding.
export async function countryForPoint([lng, lat]) {
    try {
        const url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
            `?types=country&limit=1&language=en&access_token=${mapboxgl.accessToken}`;
        const res = await fetch(url);
        if (!res.ok) return '';
        const data = await res.json();
        return data.features?.[0]?.text || '';
    } catch {
        return '';
    }
}

// Inline globe: click to drop (or move) the pin, or use the device's location.
const LocationPicker = ({ value, onChange }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onChangeRef = useRef(onChange);
    const [status, setStatus] = useState('');

    onChangeRef.current = onChange;

    useEffect(() => {
        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/aalokok/cm469v2sd00r701qr9jr47x3i',
            center: [0, 20],
            zoom: window.matchMedia('(max-width: 760px)').matches ? 0.7 : 1.3, // whole globe visible on phones
            projection: 'globe',
            attributionControl: false, // replaced by the compact (ⓘ) version below
        });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
        mapRef.current = map;
        map.on('style.load', () => applyBrandToMap(map));
        map.on('click', (e) => onChangeRef.current([e.lngLat.lng, e.lngLat.lat]));

        // the container can change size (phone step switch, window resize)
        const ro = new ResizeObserver(() => map.resize());
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            markerRef.current = null;
            map.remove();
        };
    }, []);

    // Keep the pin in sync with the chosen point
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!value) {
            markerRef.current?.remove();
            return;
        }
        if (!markerRef.current) {
            markerRef.current = new mapboxgl.Marker({ color: getToken('--color-marker', '#FFC5B3') });
        }
        markerRef.current.setLngLat(value).addTo(map);
    }, [value]);

    const useMyLocation = () => {
        if (!navigator.geolocation) {
            setStatus("this browser can't share its location — tap the globe instead");
            return;
        }
        setStatus('finding you…');
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const p = [coords.longitude, coords.latitude];
                onChangeRef.current(p);
                mapRef.current?.flyTo({ center: p, zoom: 5 });
                setStatus('');
            },
            () => setStatus("couldn't get your location — tap the globe instead"),
            { enableHighAccuracy: false, timeout: 10000 }
        );
    };

    return (
        <div className="globe-picker">
            <div className="globe-picker-dots" aria-hidden="true" />
            <div ref={containerRef} className="globe-picker-map" aria-label="Globe: click to place the photo's location" />
            <div className="globe-picker-bar">
                <p className="globe-picker-hint">
                    {status || (value ? 'pin dropped — click again to move it' : 'click the globe to drop a pin')}
                </p>
                <button type="button" className="upload-link" onClick={useMyLocation}>use my location</button>
            </div>
        </div>
    );
};

export default LocationPicker;
