const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
    name:  { type: String, required: true, maxlength: 16, trim: true },
    score: { type: Number, required: true, min: 0 },
    wave:  { type: Number, required: true, min: 1 },
    date:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Score', scoreSchema);
