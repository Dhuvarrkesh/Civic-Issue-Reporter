## Commands to Create Project using Express and TypeScript

1. npm init -y
2. npm install -D typescript
3. npx tsc --init
4. Update tsconfig.json file
   - "rootDir": "./src",
   - "outDir": "./dist",
5. npm install express
6. npm install -D @types/express
7. npm install jsonwebtoken@types/jsonwebtoken
8. npm install jsonwebtoken
9. npm install zod (//zod validation in pending).
10. npm install multer (used for uploading media in database).
11. npm install @types/multer
12. npm install cloudinary multer-storage-cloudinary multer
13. npm install --save-dev @types/multer
14. npm install cors
15. npm install --save-dev @types/cors
16. npm install cookie-parser
17. npm install --save-dev @types/cookie-parser
18. npm install nodemon
19. npm install bcryptjs
20. npm install --save-dev @types/bcryptjs
21. npm install react-hook-form @hookform/resolvers zod

Environment variables used by the new escalation / duplicate detection features:

- ESCALATION_DAYS (default: 7) — number of days without update before an issue is escalated
- MAX_ESCALATION_LEVEL (default: 2) — maximum escalation level
- ESCALATION_CHECK_INTERVAL_MS (default: 86400000) — how frequently the escalation job runs in ms
- DUPLICATE_THRESHOLD_METERS (default: 50) — distance threshold (meters) to treat two reports as duplicates
- ADMIN_INVITE_CODE — invite code (string) used to create Level-2 admins via the signup form (set in `backend/.env` and keep it secret)
- ADMIN_INVITE_CODE — secret invite code required to create Level-2 admins (recommended for production)

Notes on schema changes / migration:

- `Admin` now has `accessLevel` (number, default 1). Set admins to `accessLevel: 2` to create higher-level admins.
- `Issue` now has `escalationLevel` (number) and `escalatedTo` (Admin id). Default `escalationLevel` is 1.
- The `title` field is no longer required to be unique; if you previously had a unique index on `title` in your DB you may need to drop that index manually (use `db.issues.dropIndex('title_1')`).

Testing the escalation and duplicate-detection features:

1. Create two admins: one with `accessLevel: 1` and another with `accessLevel: 2` (via the admin signup endpoint or directly in DB).
2. Create a citizen and post an issue (use `DUPLICATE_THRESHOLD_METERS=50` default). Attempt posting a very close duplicate: the API will return a 400 with `Possible duplicate issue exists`.
3. To test escalation quickly set `ESCALATION_DAYS=0` and `ESCALATION_CHECK_INTERVAL_MS=5000` (5 seconds), then start the server. Issues not updated will be escalated to level 2 and will appear on `GET /api/v1/admin/escalated-issues`.

Manual escalation endpoint:

- `POST /api/v1/admin/issue/:issueid/escalate` — can be called by level-1 admins to escalate an issue immediately. The API sets `escalationLevel`++, status to `Pending`, clears `handledBy` and `escalatedTo`, and records a `Pending` status history entry.4. Sign in as a level-2 admin and use `POST /api/v1/admin/issue/:issueid/assign` to take the issue (it will set status to "In Progress" and create a status history record).

## Duplicate aggregation (image pHash)

The backend now aggregates duplicate reports automatically when a new report matches an existing issue by **location + type** and either **image similarity (pHash)** or **text similarity**.

- New fields:
  - `Multimedia.phash` — stores perceptual hash for images.
  - `Issue.reportCount` — number of reports aggregated into the issue.
  - `Issue.reporters` — array of `Citizen` ids who reported the issue.

- New script: `backfill-phash` — computes pHashes for existing image media and stores them.

To install new dependencies and backfill existing media:
1. Run `npm install` in `backend/` to pick up `image-hash` and `jimp`.
2. Run `npm run build`.
3. Run `npm run backfill-phash` to compute pHashes for existing media (optional but recommended).

Environment variables you can tune:
- `PHASH_HAMMING_THRESHOLD` (default: 10)
- `DUPLICATE_TIME_WINDOW_DAYS` (default: 30)
- `TEXT_SIMILARITY_THRESHOLD` (default: 0.6)


