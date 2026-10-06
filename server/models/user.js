const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: /^\S+@\S+\.\S+$/
    },

    password: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: /^[6-9]\d{9}$/
    },

    bloodGroup: {
        type: String,
        required: true
    }

}, {
    timestamps: true
});

const user = mongoose.model("user", userSchema);

module.exports = user;
