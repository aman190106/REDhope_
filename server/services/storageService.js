/**
 * REDhope Private Medical Document Storage Service
 * 
 * Abstraction layer for private medical document storage.
 * - Stores files strictly OUTSIDE web-accessible directories
 * - Validates file signatures (magic bytes) to prevent executable injection
 * - Enforces 5MB size limit and allowed MIME types (PDF, JPEG, PNG)
 * - Sanitizes original filenames to prevent path traversal
 * - Provides streams for authenticated, authorized downloads
 * 
 * Production Requirement Note:
 * In production deployments, this local development adapter should be switched
 * to a private cloud object store (e.g. AWS S3 with SSE-KMS, Google Cloud Storage,
 * or Azure Blob Storage) with encryption-at-rest and strict IAM bucket policies.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORAGE_DIR = process.env.MEDICAL_STORAGE_DIR || path.join(__dirname, "../storage/medical_documents");

// Ensure private directory exists on startup
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

// Magic byte signatures for verified file types
const FILE_SIGNATURES = {
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    jpeg: [0xFF, 0xD8, 0xFF],      // JPEG SOI marker
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] // PNG signature
};

/**
 * Validates buffer against known magic byte signatures.
 */
function verifyMagicBytes(buffer, mimeType) {
    if (!buffer || buffer.length < 4) return false;

    if (mimeType === "application/pdf") {
        return FILE_SIGNATURES.pdf.every((byte, idx) => buffer[idx] === byte);
    }

    if (mimeType === "image/jpeg") {
        return FILE_SIGNATURES.jpeg.every((byte, idx) => buffer[idx] === byte);
    }

    if (mimeType === "image/png") {
        return FILE_SIGNATURES.png.every((byte, idx) => buffer[idx] === byte);
    }

    return false;
}

/**
 * Sanitizes original filename: removes path traversals, null bytes, and illegal characters.
 */
function sanitizeFileName(fileName) {
    if (!fileName || typeof fileName !== "string") {
        return "document";
    }

    // Strip path traversal attempts and backslashes/slashes
    const base = path.basename(fileName).replace(/[\/\\]/g, "").replace(/\0/g, "");
    // Replace non-whitelisted characters with underscore
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
    return cleaned.slice(0, 100) || "document";
}

/**
 * Validates file buffer, MIME type, and filename.
 */
function validateFile(buffer, originalFileName, mimeType) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        const err = new Error("invalid or missing file data");
        err.statusCode = 400;
        throw err;
    }

    if (buffer.length === 0) {
        const err = new Error("uploaded file is empty");
        err.statusCode = 400;
        throw err;
    }

    if (buffer.length > MAX_FILE_SIZE) {
        const err = new Error(`file size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        err.statusCode = 400;
        throw err;
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        const err = new Error(`unsupported file format '${mimeType}'. Allowed formats: PDF, JPG, PNG`);
        err.statusCode = 400;
        throw err;
    }

    const ext = path.extname(originalFileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        const err = new Error(`invalid file extension '${ext}'. Allowed extensions: .pdf, .jpg, .jpeg, .png`);
        err.statusCode = 400;
        throw err;
    }

    if (!verifyMagicBytes(buffer, mimeType)) {
        const err = new Error("file content does not match the declared MIME type signature (corrupted or invalid file)");
        err.statusCode = 400;
        throw err;
    }

    return true;
}

/**
 * Saves a document buffer into private local storage adapter.
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFileName - Original uploaded filename
 * @param {string} mimeType - Declared MIME type
 * @returns {Promise<{ storageKey: string, fileSize: number, sanitizedFileName: string }>}
 */
async function saveDocument(buffer, originalFileName, mimeType) {
    validateFile(buffer, originalFileName, mimeType);

    const sanitizedFileName = sanitizeFileName(originalFileName);
    const storageKey = crypto.randomUUID();
    const filePath = path.join(STORAGE_DIR, storageKey);

    await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });

    return {
        storageKey,
        fileSize: buffer.length,
        sanitizedFileName
    };
}

/**
 * Retrieves a ReadStream for the stored file.
 * 
 * @param {string} storageKey 
 * @returns {fs.ReadStream}
 */
function getDocumentStream(storageKey) {
    if (!storageKey || typeof storageKey !== "string" || storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
        const err = new Error("invalid storage key");
        err.statusCode = 400;
        throw err;
    }

    const filePath = path.join(STORAGE_DIR, storageKey);
    if (!fs.existsSync(filePath)) {
        const err = new Error("document file not found in storage");
        err.statusCode = 404;
        throw err;
    }

    return fs.createReadStream(filePath);
}

/**
 * Retrieves the full Buffer for the stored file.
 * 
 * @param {string} storageKey 
 * @returns {Promise<Buffer>}
 */
async function getDocumentBuffer(storageKey) {
    if (!storageKey || typeof storageKey !== "string" || storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
        const err = new Error("invalid storage key");
        err.statusCode = 400;
        throw err;
    }

    const filePath = path.join(STORAGE_DIR, storageKey);
    if (!fs.existsSync(filePath)) {
        const err = new Error("document file not found in storage");
        err.statusCode = 404;
        throw err;
    }

    return fs.promises.readFile(filePath);
}

/**
 * Safely removes a file from storage.
 * 
 * @param {string} storageKey 
 * @returns {Promise<boolean>}
 */
async function deleteDocument(storageKey) {
    if (!storageKey || typeof storageKey !== "string" || storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
        return false;
    }

    const filePath = path.join(STORAGE_DIR, storageKey);
    if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
    }

    return false;
}

module.exports = {
    saveDocument,
    getDocumentStream,
    getDocumentBuffer,
    deleteDocument,
    sanitizeFileName,
    validateFile,
    MAX_FILE_SIZE,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS
};

