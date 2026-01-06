import { Request, Response } from "express";
import { IssueModel } from "../models/issue.model";
import { MultimediaModel } from "../models/multimedia.model";
import { computePhash, hammingDistance } from "../utils/image";

export const createIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];

    const { title = "Untitled", description, location, issueType } = req.body;
    // location stuff

    let parsedLocation = location;
    if (typeof location === "string") {
      try {
        parsedLocation = JSON.parse(location);
      } catch {
        res.status(400).json({ message: "Invalid location JSON format" });
        return;
      }
    }

    if (
      !title ||
      !description ||
      !parsedLocation ||
      !parsedLocation.latitude ||
      !parsedLocation.longitude ||
      !issueType
    ) {
      res.status(400).json({ message: "Please fill all the required fields " });
      return;
    }

    // Duplicate detection (geo + time + image pHash + text fallback)
    const THRESHOLD_METERS = Number(process.env.DUPLICATE_THRESHOLD_METERS) || 50; // 50 meters default
    const PHASH_THRESHOLD = Number(process.env.PHASH_HAMMING_THRESHOLD) || 10; // Hamming distance threshold
    const TIME_WINDOW_DAYS = Number(process.env.DUPLICATE_TIME_WINDOW_DAYS) || 30;
    const TEXT_SIMILARITY_THRESHOLD = Number(process.env.TEXT_SIMILARITY_THRESHOLD) || 0.6;

    // bounding box helper
    const metersToLatDegrees = (m: number) => m / 111320;
    const metersToLonDegrees = (m: number, lat: number) => m / (111320 * Math.cos((lat * Math.PI) / 180));

    const deltaLat = metersToLatDegrees(THRESHOLD_METERS);
    const deltaLon = metersToLonDegrees(THRESHOLD_METERS, parsedLocation.latitude);

    // restrict by time window to keep candidate list small
    const timeCutoff = new Date(Date.now() - TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const nearbyCandidates = await IssueModel.find({
      issueType,
      status: { $nin: ["Resolved", "Rejected"] },
      createdAt: { $gte: timeCutoff },
      "location.latitude": {
        $gte: parsedLocation.latitude - deltaLat,
        $lte: parsedLocation.latitude + deltaLat,
      },
      "location.longitude": {
        $gte: parsedLocation.longitude - deltaLon,
        $lte: parsedLocation.longitude + deltaLon,
      },
    }).lean();

    // helper: simple Jaccard on combined title+description
    const jaccard = (a: string, b: string) => {
      if (!a || !b) return 0;
      const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
      const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
      const inter = [...setA].filter((x) => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size || 1;
      return inter / union;
    };

    // compute pHashes for incoming image files (skip videos)
    const imageFiles = files.filter((f) => !f.mimetype.startsWith("video"));
    const incomingPhashes = await Promise.all(
      imageFiles.map((file) => computePhash(file.path).catch(() => null))
    );

    let matchedCandidate: any = null;

    for (const cand of nearbyCandidates) {
      // precise distance check first
      const toRad = (v: number) => (v * Math.PI) / 180;
      const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const dist = haversineMeters(
        parsedLocation.latitude,
        parsedLocation.longitude,
        (cand.location as any).latitude,
        (cand.location as any).longitude
      );

      if (dist > THRESHOLD_METERS) continue;

      // try image-based match
      const candidateMedia = await MultimediaModel.find({ issueID: cand._id }).lean();
      let imageMatch = false;
      for (const cm of candidateMedia) {
        if (!cm.phash) continue;
        for (const inPh of incomingPhashes) {
          if (!inPh) continue;
          const hd = hammingDistance(cm.phash, inPh);
          if (hd <= PHASH_THRESHOLD) {
            imageMatch = true;
            break;
          }
        }
        if (imageMatch) break;
      }

      if (imageMatch) {
        matchedCandidate = cand;
        break;
      }

      // fallback: text similarity on title+description
      const inText = `${title} ${description}`;
      const candText = `${(cand as any).title || ""} ${(cand as any).description || ""}`;
      const sim = jaccard(inText, candText);
      if (sim >= TEXT_SIMILARITY_THRESHOLD) {
        matchedCandidate = cand;
        break;
      }
    }

    const reporterId = (req as any).citizenId || null;

    if (matchedCandidate) {
      // aggregate: increment reportCount and add reporter
      const updated = await IssueModel.findByIdAndUpdate(
        matchedCandidate._id,
        {
          $inc: { reportCount: 1 },
          $addToSet: { reporters: reporterId },
        },
        { new: true }
      );

      // attach uploaded media to existing issue
      const mediaDocs = await Promise.all(
        files.map(async (file) => {
          const fileType = file.mimetype.startsWith("video") ? "video" : "image";
          const phash = fileType === "image" ? (await computePhash(file.path).catch(() => null)) : null;
          return MultimediaModel.create({
            issueID: matchedCandidate._id,
            fileType,
            url: file.path,
            filename: file.originalname,
            phash,
          });
        })
      );

      res.status(200).json({ message: "Report aggregated into existing issue", issue: updated, media: mediaDocs });
      return;
    }

    // Not a duplicate: create new issue and attach media
    const newIssue = await IssueModel.create({
      citizenId: reporterId,
      issueType,
      title,
      description,
      location: parsedLocation,
      status: "Reported",
      reportCount: 1,
      reporters: reporterId ? [reporterId] : [],
    });

    const mediaDocs = await Promise.all(
      files.map(async (file, idx) =>
        MultimediaModel.create({
          issueID: newIssue._id,
          fileType: file.mimetype.startsWith("video") ? "video" : "image",
          url: file.path,
          filename: file.originalname,
          phash: incomingPhashes[idx] || undefined,
        })
      )
    );

    console.log("Response body:", {
      message: "Issue created",
      media: mediaDocs,
    });

    res.status(200).json({ message: "Issue created", issue: newIssue, media: mediaDocs });
  } catch (error) {
    console.error("Error creating issue:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getIssues = async (req: Request, res: Response) => {
  try {
    const issues = await IssueModel.find({})
      .populate("citizenId", "fullName")
      .populate("handledBy", "fullName")
      .populate("escalatedTo", "fullName")
      .lean();

    const issuesWithMedia = await Promise.all(
      issues.map(async (issue) => {
        const media = await MultimediaModel.find({ issueID: issue._id });
        return {
          _id: issue._id,
          title: issue.title,
          description: issue.description,
          type: issue.issueType,
          location: issue.location, //  send only address
          reportedBy: (issue.citizenId as any)?.fullName || "Anonymous",
          reportedAt: issue.createdAt,
          image: media.length > 0 ? media[0].url : null,
          status: issue.status,
          escalationLevel: (issue as any).escalationLevel || 1,
          escalatedTo: (issue as any).escalatedTo ? (issue as any).escalatedTo.fullName || (issue as any).escalatedTo : null,
          handledBy: (issue as any).handledBy ? (issue as any).handledBy.fullName || (issue as any).handledBy : null,
        };
      })
    );

    res.json({ issues: issuesWithMedia });
  } catch (err) {
    console.error("Error fetching issues:", err);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
};
