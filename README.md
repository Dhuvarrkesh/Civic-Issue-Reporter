# Project Workflows & Feature Implementation — (Detailed)

This document explains *how each feature is implemented*, and shows the **end-to-end flow** (frontend → backend → DB) with an emphasis on the duplicate-detection logic and the implementation details for every major feature.

---

## Overview
- Frontend: React + TypeScript (Vite). Mapbox used for geocoding and map UI.
- Backend: Node + Express + TypeScript. MongoDB + Mongoose for persistence.
- Media: Cloudinary (via `multer-storage-cloudinary`) for uploads.

---

## Feature-by-feature implementation (engineer-level)

### 1) Authentication
- Implementation:
  - JWT-based auth with a `Citizen` model and `Admin` model (Mongoose).
  - Authentication middleware verifies JWT and sets `req.citizenId` or `req.adminId`.
- Files:
  - `src/models/citizen.model.ts`, `src/controllers/auth-controllers/*`, `src/middlerware/auth.middleware.ts`

### 2) Issue reporting (UI + API)
- Frontend:
  - `ReportIssue.tsx` collects `title`, `description`, `issueType`, `location`, and optional `file`.
  - Location can be provided by typing an address (forward geocode on blur) or interacting with the Map (click to set marker + reverse geocode). The address text input calls Mapbox forward geocoding if coordinates are not present.
  - Form submission sends a multipart `FormData` request to `POST /api/v1/citizen/create-issue` with `location` serialized as JSON and the file(s).
- Backend:
  - `createIssue` validates required fields: `title`, `description`, `issueType`, and `location.latitude`/`location.longitude`.
  - Files are handled by `multer` + `multer-storage-cloudinary` (middleware) and a file metadata array is available to the controller.
  - For each image, compute perceptual hash (pHash) via `image-hash` and store in `Multimedia.phash`.
  - Duplicate detection runs (see section below). Depending on result, either create new `Issue` or aggregate into existing issue.
- Files:
  - `frontend/src/pages/ReportIssue.tsx`, `frontend/src/components/MapBox.tsx`, `backend/src/controllers/issues.controllers.ts`, `backend/src/middlerware/upload.middleware.ts`

### 3) Media storage & pHash
- Implementation:
  - After upload to Cloudinary, store `url`, `filename`, and the computed `phash` into `Multimedia` documents.
  - pHash computation is done using `image-hash` in `src/utils/image.ts`.
- Backfill:
  - `src/scripts/backfill-phash.ts` iterates existing `Multimedia` entries missing `phash` and computes them in batch.

### 4) Duplicate detection & aggregation (detailed)
- Goals:
  - Avoid storing multiple issues for the same real-world problem.
  - Allow multiple reporters to be tracked on a single canonical issue (report aggregation).

- Steps implemented in `createIssue`:
  1. **Geo/time/type prefilter**
     - Query candidate issues where `issueType` is same, `status` not in `[Resolved, Rejected]`, `createdAt >= now - DUPLICATE_TIME_WINDOW_DAYS`.
     - Apply a bounding box based on `DUPLICATE_THRESHOLD_METERS` (meters → degrees) to keep result set small.
  2. **Precise distance**
     - For each candidate compute Haversine distance to the incoming location; discard if > `DUPLICATE_THRESHOLD_METERS`.
  3. **Image similarity (preferred)**
     - If incoming images exist, compute pHash for each incoming image.
     - Load candidate issue media docs and compare their `phash` with incoming pHash values using Hamming distance (`hammingDistance` helper).
     - If any candidate media has `hamming <= PHASH_HAMMING_THRESHOLD` → treat as duplicate match.
  4. **Text fallback (if no image match)**
     - Use a lightweight token Jaccard similarity on `title + description` as a fallback when images don't help.
     - If similarity >= `TEXT_SIMILARITY_THRESHOLD`, treat as match.
  5. **Aggregate or create**
     - On match: update existing issue: `$inc: { reportCount: 1 }`, `$addToSet: { reporters: reporterId }`. Also create and attach `Multimedia` docs for any uploaded media.
     - No match: create a new `Issue` with `reportCount = 1` and `reporters = [reporterId]`.

- Rationale & tuning:
  - Geo/time/type prefilter reduces computational cost and improves accuracy.
  - pHash + Hamming works well for photographs of the same object/scene; tune `PHASH_HAMMING_THRESHOLD` (default 10 for 64-bit pHashes).
  - Text fallback helps when images are missing.

- Files & helpers:
  - `backend/src/controllers/issues.controllers.ts` — implements the pipeline.
  - `backend/src/utils/image.ts` — `computePhash()` and `hammingDistance()`.

### 5) Escalation job
- Implementation:
  - Periodic job (`src/jobs/escalation.job.ts`) that checks for issues not updated for `ESCALATION_DAYS` and escalates them (increment `escalationLevel`, set status to `Pending`, optionally notify/assign).
- Config via env vars: `ESCALATION_DAYS`, `ESCALATION_CHECK_INTERVAL_MS`.

### 6) Admin features
- Admin UI can list issues and see `reportCount`, images, status, and location.
- Endpoints allow assigning (`POST /api/v1/admin/issue/:id/assign`), escalating, resolving, and deleting issues.
- The design allows adding a manual duplicate review panel later.

---

## How to test duplicate detection locally (recommended checklist)
1. Start backend and frontend.
2. Create a citizen account and sign in.
3. Post an issue with an image at location X (keep a copy of the image file).
4. Post the same issue again at location X (within `DUPLICATE_THRESHOLD_METERS`) using the same image — expected: the second request should be aggregated (existing `Issue` updated, `reportCount` incremented, and API returns the existing issue).
5. Try posting a similar issue with a slightly different photo (same scene) and check how `PHASH_HAMMING_THRESHOLD` affects detection.
6. Test text-only duplicates: post two reports without images but with highly similar titles/descriptions and confirm text fallback triggers.

---

## Implementation notes & caveats
- pHash is a practical choice: fast and easy to compute, works well on same-scene photos. It is not perfect for very different viewpoints or for videos.
- If upload latency becomes user-facing, move pHash computation and duplicate detection to a background worker and respond immediately with a pending state.
- Consider adding vector embeddings (CLIP) and a nearest-neighbor search for high-accuracy image matching at large scale.

---

## Key files quick map
- backend:
  - `src/controllers/issues.controllers.ts` — core create / duplicate logic
  - `src/models/issue.model.ts`, `src/models/multimedia.model.ts` — schemas
  - `src/utils/image.ts` — pHash helpers
  - `src/scripts/backfill-phash.ts` — migration/backfill script
  - `src/jobs/escalation.job.ts` — escalation
- frontend:
  - `src/pages/ReportIssue.tsx`, `src/components/MapBox.tsx` — reporting UX + geocoding

---
