const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username:     { type: String, required: true, unique: true, minlength: 3, maxlength: 20, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    dateOfBirth:  { type: Date, required: true },
    createdAt:    { type: Date, default: Date.now },
    gamesPlayed:  { type: Number, default: 0 },
    highScore:    { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
