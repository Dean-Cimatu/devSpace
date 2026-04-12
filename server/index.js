require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/colosseum';

// Start HTTP server immediately so Railway's healthcheck can reach /health
// even before MongoDB finishes connecting
const server = app.listen(PORT, () => {
    console.log(`Colosseum Fighters running on http://localhost:${PORT}`);
    console.log(`MONGO_URI set: ${!!process.env.MONGO_URI}`);
    console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
});

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err.message);
        // Don't exit — keep server alive so healthcheck passes and logs are visible
    });
