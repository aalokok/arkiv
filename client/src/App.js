import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Map from './components/Map';
import UploadForm from './components/UploadForm';
import './App.css';

function App() {
    const [geojsonData, setGeojsonData] = useState(null); // Start with null instead of empty object
    const [isLoading, setIsLoading] = useState(true);

    // Fetch GeoJSON data from the backend
    const fetchGeoJSON = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/markers');
            const data = await response.json();
            setGeojsonData({
                type: 'FeatureCollection',
                features: data.features || [] // Ensure features exists
            });
        } catch (error) {
            console.error('Error fetching GeoJSON data:', error);
            setGeojsonData({
                type: 'FeatureCollection',
                features: []
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGeoJSON(); // Fetch marker data when the app loads
    }, []);

    return (
        <Router>
            <Header />
            <Routes>
                <Route
                    path="/"
                    element={
                        <Map
                            geojsonData={geojsonData}
                            isLoading={isLoading}
                        />
                    }
                />
                <Route
                    path="/upload"
                    element={<UploadForm onMarkerAdded={fetchGeoJSON} />}
                />
            </Routes>
        </Router>
    );
}

export default App;
