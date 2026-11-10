const mongoose = require('mongoose');

// Reuse the connection across invocations while the function instance is warm.
let connectionPromise = global._mongooseConnection;
function connect() {
    if (!connectionPromise) {
        connectionPromise = global._mongooseConnection = mongoose
            .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
            .catch((err) => {
                // Clear the cache so the next request retries instead of reusing a failed promise.
                connectionPromise = global._mongooseConnection = null;
                throw err;
            });
    }
    return connectionPromise;
}

const MarkerSchema = new mongoose.Schema({
    owner: String,
    photographer: String,
    story: String,
    date: String,
    usage: String,
    email: String,
    equipment: String,
    image: String, // Cloudinary URL
    location: {
        type: [Number], // [lng, lat]
        required: true,
    },
    country: String,
});

const Marker = mongoose.models.Marker || mongoose.model('Marker', MarkerSchema);

module.exports = async (req, res) => {
    try {
        await connect();
    } catch (error) {
        console.error('Error connecting to MongoDB Atlas:', error);
        return res.status(500).json({ error: 'Database connection failed' });
    }

    if (req.method === 'GET') {
        try {
            // Only what the site shows. Never send email (or the unused equipment field): they stay
            // in the database but are never handed to visitors.
            const markers = await Marker.find({}, 'owner photographer story date country image location').lean();
            return res.status(200).json({
                type: 'FeatureCollection',
                features: markers.map((marker) => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: marker.location },
                    properties: {
                        owner: marker.owner,
                        story: marker.story,
                        date: marker.date,
                        country: marker.country,
                        photographer: marker.photographer,
                        image: marker.image,
                        // upload time, read from the MongoDB id (ids carry their creation time),
                        // so older entries have it too; used to browse "recent"
                        created: marker._id.getTimestamp().toISOString(),
                    },
                })),
            });
        } catch (error) {
            console.error('Error fetching marker data:', error);
            return res.status(500).json({ error: 'Error fetching marker data' });
        }
    }

    if (req.method === 'POST') {
        try {
            // An exact repeat of an existing entry (same title, author, caption, date and pin) is a
            // double submit, not a new photo: answer as if saved, but don't store it again.
            const { owner, photographer, story, date, location } = req.body || {};
            const repeat = await Marker.exists({ owner, photographer, story, date, location });
            if (repeat) return res.status(200).json({ message: 'Already saved' });

            await new Marker(req.body).save();
            return res.status(201).json({ message: 'Marker saved successfully!' });
        } catch (error) {
            console.error('Error saving marker data:', error);
            return res.status(400).json({ error: 'Error saving marker data' });
        }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
};
