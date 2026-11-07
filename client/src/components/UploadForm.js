import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import './UploadForm.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica",
    "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. Swaziland)", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
    "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
    "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea (North)", "Korea (South)",
    "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
    "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
    "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
    "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
    "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela",
    "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];
const UploadForm = ({ onMarkerAdded }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);

    const [formData, setFormData] = useState({
        owner: '',
        photographer: '',
        story: '',
        date: '',
        usage: 'open',
        email: '',
        equipment: '',
        country: '',
        image: null,
        location: null,
    });

    const [markerData, setMarkerData] = useState({
        type: 'FeatureCollection',
        features: [],
    });

    useEffect(() => {
        if (!mapInstance.current) {
            mapInstance.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/aalokok/cm469v2sd00r701qr9jr47x3i',
                center: [0, 0],
                zoom: 1.5,
                projection: 'globe',
            });

            mapInstance.current.on('load', () => {
                mapInstance.current.addSource('marker', {
                    type: 'geojson',
                    data: markerData,
                });

                mapInstance.current.addLayer({
                    id: 'marker-layer',
                    type: 'circle',
                    source: 'marker',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': '#FF0000',
                    },
                });

                mapInstance.current.on('click', (e) => {
                    const { lng, lat } = e.lngLat;
                    const newMarker = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat],
                        },
                    };

                    setMarkerData({
                        type: 'FeatureCollection',
                        features: [newMarker],
                    });

                    setFormData((prev) => ({ ...prev, location: [lng, lat] }));
                });
            });
        }

        if (mapInstance.current && mapInstance.current.isStyleLoaded()) {
            const source = mapInstance.current.getSource('marker');
            if (source) {
                source.setData(markerData);
            }
        }
    }, [markerData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (file) => {
        const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/digb5lz1t/image/upload';
        const uploadPreset = 'archive';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        try {
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            return data.secure_url; // Return the URL of the uploaded image
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.location) {
            alert('Please drop a marker on the map to select a location.');
            return;
        }

        if (!formData.country) {
            alert('Please select a country.');
            return;
        }

        let updatedFormData = { ...formData }; // Clone formData

        const imageFile = document.getElementById('image').files[0];
        if (imageFile) {
            const imageUrl = await handleImageUpload(imageFile);
            if (!imageUrl) {
                alert('Image upload failed. Please try again.');
                return;
            }
            updatedFormData = { ...updatedFormData, image: imageUrl }; // Add the image URL
        }

        try {
            const response = await fetch('/api/markers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedFormData), // Send updated formData
            });

            if (response.ok) {
                alert('Upload successful!');
                onMarkerAdded();
            } else {
                alert('Error uploading data.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };


    return (
        <div className="upload-form-container">
            <div className="upload-form">
                <div className="form-scrollable">
                    <h1 className="form-title">Upload</h1>
                    <form>
                        <div className="form-group">
                            <label htmlFor="owner">Title:</label>
                            <input
                                type="text"
                                id="owner"
                                name="owner"
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="photographer">Photographer:</label>
                            <input
                                type="text"
                                id="photographer"
                                name="photographer"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="story">Story:</label>
                            <textarea
                                id="story"
                                name="story"
                                onChange={handleChange}
                                required
                            ></textarea>
                        </div>

                        <div className="form-group">
                            <label htmlFor="date">Date:</label>
                            <input
                                type="date"
                                id="date"
                                name="date"
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="country">Country:</label>
                            <select
                                id="country"
                                name="country"
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select a country</option>
                                {countries.map((country) => (
                                    <option key={country} value={country}>
                                        {country}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email:</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="equipment">Equipment:</label>
                            <input
                                type="text"
                                id="equipment"
                                name="equipment"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="image">Image:</label>
                            <input
                                type="file"
                                id="image"
                                accept="image/*"
                            />
                        </div>
                    </form>
                </div>
            </div>

            <div className="map-container">
                <div className="map-instructions">
                    Click anywhere on the map to place a marker for your photo's location
                </div>
                <div className="upload-map-container" ref={mapContainer}></div>
                <div className="submit-button-container">
                    <button
                        type="button"
                        className="submit-button"
                        onClick={handleSubmit}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadForm;
