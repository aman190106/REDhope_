const mongoose = require("mongoose");

const VALID_STATUSES = ["draft", "published", "completed", "cancelled"];

const campSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "camp name is required"],
        trim: true,
        minlength: [3, "camp name must be at least 3 characters"],
        maxlength: [100, "camp name cannot exceed 100 characters"]
    },

    description: {
        type: String,
        trim: true,
        maxlength: [1000, "description cannot exceed 1000 characters"]
    },

    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "organizer reference is required"]
    },

    location: {
        address: {
            type: String,
            required: [true, "address is required"],
            trim: true
        },
        city: {
            type: String,
            required: [true, "city is required"],
            trim: true
        },
        state: {
            type: String,
            required: [true, "state is required"],
            trim: true
        },
        pincode: {
            type: String,
            required: [true, "pincode is required"],
            trim: true,
            validate: {
                validator: function (pin) {
                    return /^[1-9][0-9]{5}$/.test(pin);
                },
                message: "invalid Indian pincode format"
            }
        },
        type: {
            type: String,
            enum: ["Point"],
            default: undefined
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            validate: {
                validator: function (coords) {
                    if (!coords || coords.length === 0) return true;
                    if (coords.length !== 2) return false;
                    const [lng, lat] = coords;
                    return typeof lng === "number" && typeof lat === "number" &&
                           lng >= -180 && lng <= 180 &&
                           lat >= -90 && lat <= 90;
                },
                message: "coordinates must be valid [longitude, latitude] numbers"
            },
            default: undefined
        }
    },

    startDate: {
        type: Date,
        required: [true, "camp start date is required"]
    },

    endDate: {
        type: Date,
        required: [true, "camp end date is required"],
        validate: {
            validator: function (val) {
                if (!this.startDate || !val) return true;
                const startDay = new Date(this.startDate);
                startDay.setHours(0, 0, 0, 0);
                const endDay = new Date(val);
                endDay.setHours(0, 0, 0, 0);
                return endDay >= startDay;
            },
            message: "end date must be after or equal to start date"
        }
    },

    startTime: {
        type: String,
        required: [true, "start time is required"],
        trim: true,
        match: [/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be in HH:mm format (e.g. 09:00)"]
    },

    endTime: {
        type: String,
        required: [true, "end time is required"],
        trim: true,
        match: [/^([01]\d|2[0-3]):[0-5]\d$/, "endTime must be in HH:mm format (e.g. 17:00)"]
    },

    capacity: {
        type: Number,
        required: [true, "donor capacity is required"],
        min: [1, "capacity must be at least 1"]
    },

    registrationCount: {
        type: Number,
        default: 0,
        min: [0, "registration count cannot be negative"]
    },

    status: {
        type: String,
        enum: {
            values: VALID_STATUSES,
            message: "invalid camp status"
        },
        default: "draft"
    },

    requireHealthScreening: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

// Sparse geospatial index on location.coordinates
campSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

// Compound indexes for discovery and organizer lookups
campSchema.index({ status: 1, "location.city": 1, startDate: 1 });
campSchema.index({ organizer: 1, status: 1 });

const camp = mongoose.model("camp", campSchema);

module.exports = camp;

