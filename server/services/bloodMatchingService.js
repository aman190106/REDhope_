/**
 * REDhope Blood Matching Service
 * 
 * Computes compatible, medically eligible, and available blood donor candidates
 * for a recipient blood requirement, optionally ranked by geographic proximity.
 * 
 * Read-only engine. Does not persist match results.
 */

const user = require("../models/user");
const HealthScreening = require("../models/healthScreening");
const { evaluateEligibility } = require("./eligibilityService");
const {
    isValidBloodGroup,
    getCompatibleDonorBloodGroups
} = require("../rules/bloodCompatibilityRules");

const DEFAULT_RADIUS_METERS = 25000; // 25 km
const MAX_RADIUS_METERS = 500000;    // 500 km
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Finds and ranks donor candidates matching the blood requirement.
 * 
 * @param {Object} criteria
 * @param {string} criteria.bloodGroup - Required recipient blood group
 * @param {number} [criteria.latitude] - Optional latitude (-90 to 90)
 * @param {number} [criteria.longitude] - Optional longitude (-180 to 180)
 * @param {number} [criteria.radius] - Optional search radius in meters (1 to 500000)
 * @param {number} [criteria.limit] - Optional result limit (1 to 100)
 * @returns {Promise<Object>} Matching result
 */
async function findMatchingDonors({ bloodGroup, latitude, longitude, radius, limit }) {
    if (!bloodGroup || !isValidBloodGroup(bloodGroup)) {
        throw new Error("Invalid or missing blood group");
    }

    const normalizedRecipientGroup = bloodGroup.trim().toUpperCase();
    const compatibleDonorGroups = getCompatibleDonorBloodGroups(normalizedRecipientGroup);

    if (compatibleDonorGroups.length === 0) {
        return {
            bloodGroup: normalizedRecipientGroup,
            count: 0,
            matches: []
        };
    }

    // Determine if location-based search is requested
    const hasLatitude = latitude !== undefined && latitude !== null && latitude !== "";
    const hasLongitude = longitude !== undefined && longitude !== null && longitude !== "";

    if (hasLatitude !== hasLongitude) {
        const err = new Error("Both latitude and longitude must be provided for location-based matching");
        err.statusCode = 400;
        throw err;
    }

    const hasLocation = hasLatitude && hasLongitude;
    let lat;
    let lng;
    let searchRadius = DEFAULT_RADIUS_METERS;

    if (hasLocation) {
        lat = Number(latitude);
        lng = Number(longitude);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            const err = new Error("latitude must be a number between -90 and 90");
            err.statusCode = 400;
            throw err;
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            const err = new Error("longitude must be a number between -180 and 180");
            err.statusCode = 400;
            throw err;
        }

        if (radius !== undefined && radius !== null && radius !== "") {
            const parsedRadius = Number(radius);
            if (isNaN(parsedRadius) || parsedRadius <= 0) {
                const err = new Error("radius must be a positive number in meters");
                err.statusCode = 400;
                throw err;
            }
            if (parsedRadius > MAX_RADIUS_METERS) {
                const err = new Error(`radius exceeds maximum allowed limit of ${MAX_RADIUS_METERS} meters (500 km)`);
                err.statusCode = 400;
                throw err;
            }
            searchRadius = parsedRadius;
        }
    }

    // Parse and validate result limit
    let resultLimit = DEFAULT_LIMIT;
    if (limit !== undefined && limit !== null && limit !== "") {
        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) {
            const err = new Error("limit must be a positive integer");
            err.statusCode = 400;
            throw err;
        }
        resultLimit = Math.min(parsedLimit, MAX_LIMIT);
    }

    let candidates = [];

    if (hasLocation) {
        // Geospatial aggregation using 2dsphere index on location.coordinates
        // Automatically computes distanceMeters and filters by radius
        // Documents lacking coordinates are omitted from location queries
        const pipeline = [
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    distanceField: "distanceMeters",
                    maxDistance: searchRadius,
                    spherical: true,
                    query: {
                        bloodGroup: { $in: compatibleDonorGroups },
                        isDonorAvailable: true,
                        isEligible: { $ne: false }
                    }
                }
            }
        ];

        candidates = await user.aggregate(pipeline);
    } else {
        // Non-geospatial query
        candidates = await user.find({
            bloodGroup: { $in: compatibleDonorGroups },
            isDonorAvailable: true,
            isEligible: { $ne: false }
        });
    }

    // Fetch any recent health screenings for candidates
    const candidateIds = candidates.map(c => c._id);
    const candidateScreenings = candidateIds.length > 0
        ? await HealthScreening.find({ user: { $in: candidateIds } }).sort({ createdAt: -1 })
        : [];

    const screeningMap = new Map();
    for (const sc of candidateScreenings) {
        const uId = sc.user.toString();
        if (!screeningMap.has(uId)) {
            screeningMap.set(uId, sc);
        }
    }

    const matchedCandidates = [];

    for (const candidate of candidates) {
        // 1. Evaluate candidate using the authoritative eligibility engine
        const screening = screeningMap.get(candidate._id.toString()) || null;
        const eligibility = evaluateEligibility(candidate, { screening });

        // Candidate must be medically eligible and marked as available
        if (!eligibility.isMedicallyEligible || !eligibility.isDonorAvailable) {
            continue;
        }

        // 2. Determine match reasons and scoring
        const isExactMatch = candidate.bloodGroup === normalizedRecipientGroup;
        const matchReason = [];

        if (isExactMatch) {
            matchReason.push(`Exact blood group match (${candidate.bloodGroup})`);
        } else {
            matchReason.push(`Compatible blood group (${candidate.bloodGroup})`);
        }

        matchReason.push("Medically eligible");
        matchReason.push("Donor available");

        let score = 50; // Base score for eligible, available compatible donor

        if (hasLocation) {
            const dist = candidate.distanceMeters || 0;
            // Proximity points: up to 30 points inversely proportional to distance within radius
            const proximityFraction = Math.max(0, 1 - dist / searchRadius);
            const proximityPoints = Math.round(30 * proximityFraction);

            // Blood compatibility points: 20 for exact match, 10 for compatible
            const compatibilityPoints = isExactMatch ? 20 : 10;

            score = 50 + compatibilityPoints + proximityPoints;

            const distKm = (dist / 1000).toFixed(1);
            matchReason.push(`Within requested radius (${distKm} km away)`);
        } else {
            // Location omitted: base 70 + exact (30) or compatible (15)
            score = 70 + (isExactMatch ? 30 : 15);
        }

        // 3. Privacy projection: Strictly exclude private fields
        const safeCandidate = {
            userId: candidate._id.toString(),
            name: candidate.name,
            bloodGroup: candidate.bloodGroup,
            city: candidate.location && candidate.location.city ? candidate.location.city : undefined,
            state: candidate.location && candidate.location.state ? candidate.location.state : undefined,
            ...(hasLocation ? { distanceMeters: Math.round(candidate.distanceMeters) } : {}),
            score,
            matchReason
        };

        matchedCandidates.push(safeCandidate);
    }

    // 4. Deterministic sorting:
    // When location is provided: sort by score DESC, then distanceMeters ASC, then userId ASC
    // When location is omitted: sort by score DESC, then userId ASC
    matchedCandidates.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (hasLocation && a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
            if (a.distanceMeters !== b.distanceMeters) {
                return a.distanceMeters - b.distanceMeters;
            }
        }
        return a.userId.localeCompare(b.userId);
    });

    const paginatedMatches = matchedCandidates.slice(0, resultLimit);

    const result = {
        bloodGroup: normalizedRecipientGroup,
        count: paginatedMatches.length,
        totalCompatibleFound: matchedCandidates.length,
        matches: paginatedMatches
    };

    if (hasLocation) {
        result.searchLocation = {
            latitude: lat,
            longitude: lng,
            radiusMeters: searchRadius
        };
    }

    return result;
}

module.exports = {
    findMatchingDonors,
    DEFAULT_RADIUS_METERS,
    MAX_RADIUS_METERS,
    DEFAULT_LIMIT,
    MAX_LIMIT
};

