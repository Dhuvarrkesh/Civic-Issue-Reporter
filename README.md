# Project Workflows & Feature Implementation — Civic Issue Reporter

This document explains **how each feature is implemented**, showing the **end-to-end flow**
(frontend → backend → database) with a strong focus on **duplicate detection logic** and
engineering-level implementation details.

---

## Overview

**Frontend**
- React + TypeScript (Vite)
- Mapbox for maps, geocoding, and location selection

**Backend**
- Node.js + Express + TypeScript
- MongoDB with Mongoose

**Media Storage**
- Cloudinary (via `multer-storage-cloudinary`)

---

## Feature-by-Feature Implementation

### 1. Authentication
- JWT-based authentication
- Separate models for `Citizen` and `Admin`
- Middleware validates token and attaches `citizenId` or `adminId` to request

**Files**
- `backend/src/models/citizen.model.ts`
- `backend/src/controllers/auth-controllers/`
- `backend/src/middleware/auth.middleware.ts`

---

### 2. Issue Reporting (UI + API)

#### Frontend
- `ReportIssue.tsx` collects:
  - Title
  - Description
  - Issue type
  - Location
  - Optional images
- Location input:
  - Forward geocoding when typing address
  - Reverse geocoding when clicking on map
- Form submits multipart `FormData` to backend

#### Backend
- Validates required fields
- Handles file uploads using Multer + Cloudinary
- Computes perceptual hash (pHash) for images
- Runs duplicate detection logic before creating a new issue

**Files**
- `frontend/src/pages/ReportIssue.tsx`
- `frontend/src/components/MapBox.tsx`
- `backend/src/controllers/issues.controllers.ts`
- `backend/src/middleware/upload.middleware.ts`

---

### 3. Media Storage & pHash
- Images stored in Cloudinary
- Metadata stored in MongoDB:
  - URL
  - Filename
  - pHash
- pHash generated using `image-hash`

**Backfill Script**
- Computes missing pHash values for existing images

**Files**
- `backend/src/utils/image.ts`
- `backend/src/scripts/backfill-phash.ts`

---

### 4. Duplicate Detection & Aggregation (Core Logic)

**Goal**
- Prevent multiple reports for the same real-world issue
- Aggregate reports under a single issue

#### Detection Pipeline

1. **Geo / Time / Type Pre-filter**
   - Same issue type
   - Not resolved or rejected
   - Within time window
   - Inside bounding box radius

2. **Precise Distance Check**
   - Haversine formula
   - Reject if distance exceeds threshold

3. **Image Similarity (Primary)**
   - Compare pHash values
   - Use Hamming distance
   - Match if distance ≤ threshold

4. **Text Similarity (Fallback)**
   - Token-based Jaccard similarity
   - Applied when images are missing

5. **Aggregate or Create**
   - If duplicate:
     - Increment report count
     - Add reporter to set
   - Else:
     - Create new issue

**Files**
- `backend/src/controllers/issues.controllers.ts`
- `backend/src/utils/image.ts`

---

### 5. Escalation Job
- Periodic job checks stale issues
- Escalates unresolved issues automatically
- Controlled via environment variables

**File**
- `backend/src/jobs/escalation.job.ts`

---

### 6. Admin Features
- View issues with report count and media
- Assign, escalate, resolve, or delete issues
- Designed to support future manual duplicate review

---

## How to Test Duplicate Detection (Local)

1. Start frontend and backend
2. Login as citizen
3. Report an issue with an image
4. Report the same issue again:
   - Same location
   - Same image
5. Verify:
   - Issue is aggregated
   - Report count increases

---

## Implementation Notes
- pHash is fast and effective for similar images
- Text fallback improves coverage
- Can be extended using vector embeddings for higher accuracy
- Heavy computations can be offloaded to background workers

---

## Key Files Map

### Backend
- `issues.controllers.ts` – core logic
- `issue.model.ts`, `multimedia.model.ts`
- `image.ts` – pHash utilities
- `escalation.job.ts`

### Frontend
- `ReportIssue.tsx`
- `MapBox.tsx`

---
