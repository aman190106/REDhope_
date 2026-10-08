/**
 * REDhope Blood Request Service
 * 
 * Manages blood requirement creation, persists requests, queries compatible donors
 * via the Blood Matching Engine, and triggers in-app notifications.
 */

const mongoose = require("mongoose");
const bloodRequest = require("../models/bloodRequest");
const { findMatchingDonors } = require("./bloodMatchingService");
const { createNotification } = require("./notificationService");
const { isValidBloodGroup } = require("../rules/bloodCompatibilityRules");

const DEFAULT_NOTIFY_LIMIT = 50;

/**
 * Creates a blood requirement and notifies matching, eligible, and available donors.
 * 
 * @param {Object} params
 * @param {string} params.bloodGroup - Target blood group required
 * @param {number} [params.unitsNeeded=1] - Number of units needed
 * @param {string} [params.urgency='urgent'] - Urgency level
 * @param {Object} [params.location] - Optional location details (city, address, coordinates: [lng, lat])
 * @param {number} [params.radius=25000] - Search radius in meters
 * @param {string|mongoose.Types.ObjectId} params.createdBy - User ID of the requester
 * @param {number} [params.maxDonorsToNotify=50] - Maximum matching donors to notify
 * @returns {Promise<Object>} Created request and notification statistics
 */
async function createBloodRequirement({
    bloodGroup,
    unitsNeeded = 1,
    urgency = "urgent",
    location,
    radius = 25000,
    createdBy,
    maxDonorsToNotify = DEFAULT_NOTIFY_LIMIT
}) {
    if (!bloodGroup || !isValidBloodGroup(bloodGroup)) {
        const err = new Error("valid bloodGroup is required");
        err.statusCode = 400;
        throw err;
    }

    const units = Number(unitsNeeded) || 1;
    if (units < 1) {
        const err = new Error("unitsNeeded must be at least 1");
        err.statusCode = 400;
        throw err;
    }

    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
        const err = new Error("valid createdBy user ID is required");
        err.statusCode = 400;
        throw err;
    }

    const normalizedGroup = bloodGroup.trim().toUpperCase();

    // Prepare location data if supplied
    let locData;
    let lat;
    let lng;

    if (location) {
        locData = {};
        if (location.address) locData.address = String(location.address).trim();
        if (location.city) locData.city = String(location.city).trim();
        if (location.state) locData.state = String(location.state).trim();

        if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
            const [cLng, cLat] = location.coordinates.map(Number);
            if (!isNaN(cLng) && !isNaN(cLat) && cLat >= -90 && cLat <= 90 && cLng >= -180 && cLng <= 180) {
                locData.coordinates = [cLng, cLat];
                lat = cLat;
                lng = cLng;
            }
        }
    }

    // Persist BloodRequest
    const newRequest = await bloodRequest.create({
        bloodGroup: normalizedGroup,
        unitsNeeded: units,
        urgency: ["standard", "urgent", "critical"].includes(urgency) ? urgency : "urgent",
        location: locData,
        radius: Number(radius) || 25000,
        createdBy,
        status: "active"
    });

    // Find compatible, eligible, and available donors via Blood Matching Service
    const matchOptions = {
        bloodGroup: normalizedGroup,
        limit: Math.min(maxDonorsToNotify, 100)
    };

    if (lat !== undefined && lng !== undefined) {
        matchOptions.latitude = lat;
        matchOptions.longitude = lng;
        matchOptions.radius = Number(radius) || 25000;
    }

    const matchResult = await findMatchingDonors(matchOptions);
    const matchedDonors = matchResult.matches || [];

    // Notify matching donors using notificationService with deterministic eventKey
    let notifiedCount = 0;
    const locationCity = (locData && locData.city) || (locData && locData.address) || "your area";

    for (const donor of matchedDonors) {
        // Do not notify the requester if they happen to match their own request
        if (donor.userId === createdBy.toString()) {
            continue;
        }

        try {
            const eventKey = `blood-request:${newRequest._id}:${donor.userId}`;
            await createNotification({
                userId: donor.userId,
                type: "blood_match",
                title: urgency === "critical" ? "Critical Blood Requirement" : "Urgent Blood Requirement",
                message: `Urgent requirement for ${units} unit(s) of ${normalizedGroup} blood in ${locationCity}. Your donor profile was matched.`,
                metadata: {
                    bloodGroup: normalizedGroup,
                    unitsNeeded: units,
                    requestId: newRequest._id.toString(),
                    urgency: newRequest.urgency,
                    city: locationCity,
                    eventKey
                },
                eventKey
            });
            notifiedCount++;
        } catch (notifErr) {
            console.error(`Failed to notify donor ${donor.userId} for request ${newRequest._id}:`, notifErr);
        }
    }

    return {
        request: newRequest,
        notifiedCount,
        totalCompatibleFound: matchResult.totalCompatibleFound || matchedDonors.length
    };
}

/**
 * Retrieves paginated blood requests.
 */
async function getBloodRequests({ status = "active", page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status && status !== "all") {
        query.status = status;
    }

    const [requests, total] = await Promise.all([
        bloodRequest.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("createdBy", "name role")
            .lean(),
        bloodRequest.countDocuments(query)
    ]);

    return {
        requests,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 0
        }
    };
}

module.exports = {
    createBloodRequirement,
    getBloodRequests,
    DEFAULT_NOTIFY_LIMIT
};

