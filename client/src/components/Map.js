import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import './Map.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const Map = ({ geojsonData, isLoading }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [popupData, setPopupData] = useState(null);
    const [mapInitialized, setMapInitialized] = useState(false);

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
        if (!mapInstance.current) {
            mapInstance.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/aalokok/cm469v2sd00r701qr9jr47x3i',
                center: [0, 0],
                zoom: 1.5,
                projection: 'globe',
            });

            mapInstance.current.on('style.load', () => {
                setMapInitialized(true);
            });
        }
    }, []);

    // Add sources and layers once map is initialized and data is loaded
    useEffect(() => {
        if (!mapInitialized || !geojsonData || isLoading) return;

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
                    'circle-color': 'yellow',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Add click handlers
            mapInstance.current.on('click', 'marker-layer', (e) => {
                const properties = e.features[0].properties;
                setPopupData(properties);
            });

            mapInstance.current.on('mouseenter', 'marker-layer', () => {
                mapInstance.current.getCanvas().style.cursor = 'pointer';
            });

            mapInstance.current.on('mouseleave', 'marker-layer', () => {
                mapInstance.current.getCanvas().style.cursor = '';
            });
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
                    <div className="popup-details">
                        <h3>{popupData.owner}</h3>
                        <p><strong>Story:</strong> {popupData.story}</p>
                        <p><strong>Date:</strong> {popupData.date}</p>
                        <p><strong>Country:</strong> {popupData.country}</p>
                        <p><strong>Photographer:</strong> {popupData.photographer}</p>
                        <p><strong>Equipment:</strong> {popupData.equipment}</p>
                        {popupData.image && (
                            <img
                                src={popupData.image}
                                alt="Popup"
                                className="popup-image"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;