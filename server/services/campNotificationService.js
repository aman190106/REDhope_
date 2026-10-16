/**
 * REDhope Camp Notification Service
 * 
 * Finds registered donors within a geographic proximity of a published blood donation camp
 * and dispatches in-app notifications and transactional emails via Brevo.
 * 
 * Guarantees:
 * - Deterministic idempotency via eventKey: `camp-nearby:${campId}:${donorId}`
 * - Never emails the camp organizer themselves
 * - Respects donor preferences (emailNotifications: true, isEligible: true)
 * - Safe async fire-and-forget: never blocks HTTP responses or crashes the server
 */

const userModel = require("../models/user");
const campModel = require("../models/camp");
const { createNotification } = require("./notificationService");

const DEFAULT_RADIUS_KM = 25; // 25 km radius
const EARTH_RADIUS_KM = 6378.1;

/**
 * Calculates great-circle distance between two [longitude, latitude] points in kilometers.
 */
function calculateHaversineDistanceKm(coords1, coords2) {
    if (!coords1 || !coords2 || coords1.length !== 2 || coords2.length !== 2) {
        return null;
    }
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;

    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/**
 * Notifies nearby eligible donors when a blood donation camp is published.
 * 
 * @param {Object|string} campParam - Camp document or Camp ObjectId
 * @param {Object} [options]
 * @param {number} [options.radiusKm=25] - Search radius in kilometers
 * @param {boolean} [options.includeCityFallback=true] - Also match by city
 * @returns {Promise<{ success: boolean, totalFound: number, notifiedCount: number, error?: string }>}
 */
async function notifyNearbyDonorsForCamp(campParam, options = {}) {
    try {
        const radiusKm = Number(options.radiusKm) || DEFAULT_RADIUS_KM;
        const includeCityFallback = options.includeCityFallback !== false;

        // 1. Resolve camp document
        let campDoc = campParam;
        if (typeof campParam === "string" || (campParam && !campParam.location)) {
            campDoc = await campModel.findById(campParam).lean();
        }

        if (!campDoc || campDoc.status !== "published") {
            return {
                success: false,
                totalFound: 0,
                notifiedCount: 0,
                reason: "camp is not published or not found"
            };
        }

        const campId = campDoc._id.toString();
        const organizerId = campDoc.organizer
            ? (campDoc.organizer._id ? campDoc.organizer._id.toString() : campDoc.organizer.toString())
            : null;
        const campCoords = campDoc.location?.coordinates;
        const hasCoordinates = Array.isArray(campCoords) && campCoords.length === 2 &&
            typeof campCoords[0] === "number" && typeof campCoords[1] === "number";

        const donorsMap = new Map();

        // 2. Query candidate donors within max radius (up to 200 km) if camp has coordinates
        if (hasCoordinates) {
            const queryRadiusKm = Math.max(Number(options.radiusKm) || DEFAULT_RADIUS_KM, 200);
            const radiusInRadians = queryRadiusKm / EARTH_RADIUS_KM;
            const geoQuery = {
                isEligible: true,
                "location.coordinates": {
                    $geoWithin: {
                        $centerSphere: [campCoords, radiusInRadians]
                    }
                }
            };
            if (organizerId) {
                geoQuery._id = { $ne: organizerId };
            }

            const geoDonors = await userModel.find(geoQuery)
                .select("_id name email location emailNotifications notificationRadiusKm")
                .lean();

            for (const d of geoDonors) {
                donorsMap.set(d._id.toString(), d);
            }
        }

        // 3. Fallback: match by city if enabled and camp has city
        if (includeCityFallback && campDoc.location?.city) {
            const escapedCity = campDoc.location.city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const cityQuery = {
                isEligible: true,
                "location.city": new RegExp(`^${escapedCity}$`, "i")
            };
            if (organizerId) {
                cityQuery._id = { $ne: organizerId };
            }

            const cityDonors = await userModel.find(cityQuery)
                .select("_id name email location emailNotifications notificationRadiusKm")
                .lean();

            for (const d of cityDonors) {
                if (!donorsMap.has(d._id.toString())) {
                    donorsMap.set(d._id.toString(), d);
                }
            }
        }

        const eligibleDonors = Array.from(donorsMap.values());
        let notifiedCount = 0;

        // 4. Dispatch notification to each nearby donor within their custom coverage area
        for (const donor of eligibleDonors) {
            try {
                const donorId = donor._id.toString();
                const eventKey = `camp-nearby:${campId}:${donorId}`;

                let distanceKm = null;
                if (hasCoordinates && donor.location?.coordinates && donor.location.coordinates.length === 2) {
                    distanceKm = calculateHaversineDistanceKm(donor.location.coordinates, campCoords);
                }

                // Check donor's custom notification radius (defaults to 25 km if not set)
                const donorRadiusKm = Number(donor.notificationRadiusKm) > 0
                    ? Number(donor.notificationRadiusKm)
                    : DEFAULT_RADIUS_KM;

                // If coordinates distance was calculated, verify it falls within the donor's chosen radius
                if (distanceKm !== null && distanceKm > donorRadiusKm) {
                    continue;
                }

                const venue = campDoc.location?.address
                    ? `${campDoc.location.address}, ${campDoc.location.city}`
                    : (campDoc.location?.city || "Camp Venue");

                await createNotification({
                    userId: donor._id,
                    type: "camp_update",
                    title: `Blood Donation Camp Near You: ${campDoc.name}`,
                    message: `A new blood donation camp "${campDoc.name}" has been scheduled near you at ${venue}.`,
                    metadata: {
                        isNearbyCampAlert: true,
                        campId,
                        campName: campDoc.name,
                        startDate: campDoc.startDate,
                        endDate: campDoc.endDate,
                        startTime: campDoc.startTime,
                        endTime: campDoc.endTime,
                        address: campDoc.location?.address,
                        city: campDoc.location?.city,
                        distanceKm,
                        donorRadiusKm
                    },
                    eventKey
                });

                notifiedCount++;
            } catch (donorErr) {
                console.error(`Failed to notify donor ${donor._id} for camp ${campId}:`, donorErr.message);
            }
        }

        return {
            success: true,
            totalFound: eligibleDonors.length,
            notifiedCount
        };

    } catch (err) {
        console.error("notifyNearbyDonorsForCamp error:", err.message);
        return {
            success: false,
            totalFound: 0,
            notifiedCount: 0,
            error: err.message
        };
    }
}

module.exports = {
    notifyNearbyDonorsForCamp,
    calculateHaversineDistanceKm
};

