import { AdminModel } from "../models/admin.model";
import { IssueModel } from "../models/issue.model";
import { Request, Response } from "express";
import { IssueStatusHistoryModel } from "../models/issueStatusHistory.model";
import mongoose from "mongoose";

interface AuthRequest extends Request {
  adminId?: string;
}

export const getAdminProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const loggedInAdminId = req.adminId;

    if (id !== loggedInAdminId) {
      res.status(403).json({ message: "Unauthorised access" });
      return;
    }

    const admin = await AdminModel.findById(id).select("-password").lean();

    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateAdminProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { fullName, email, phonenumber, department } = req.body;

    if (!fullName || !email || !phonenumber || !department) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const updatedAdmin = await AdminModel.findByIdAndUpdate(
      id,
      { fullName, email, phonenumber, department },
      { new: true }
    );

    if (!updatedAdmin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    res.json({ message: "Profile updated successfully", user: updatedAdmin });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateIssueStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.adminId;

    const validStatuses = [
      "Reported",
      "In Progress",
      "Resolved",
      "Rejected",
      "Pending",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ message: "Invalid status value" });
      return;
    }

    const updatedIssue = await IssueModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedIssue) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }
    // Creating a record in IssueStatusHistory for this status change

    await IssueStatusHistoryModel.create({
      issueID: new mongoose.Types.ObjectId(id),
      status,
      handledBy: new mongoose.Types.ObjectId(adminId!),
      changedBy: new mongoose.Types.ObjectId(adminId!), // original reporter, optional
      changedAt: new Date(), // optional if timestamps enabled
    });

    res.json({ message: "Issue updated successfully", issue: updatedIssue });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getHandledIssuesByAdmin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const authReq = req as AuthRequest;
  try {
    const adminId = authReq.adminId; // from authMiddleware

    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const historyRecords = await IssueStatusHistoryModel.aggregate([
  {
    $match: {
      handledBy: new mongoose.Types.ObjectId(adminId),
      status: { $in: ["In Progress", "Resolved","Pending","Rejected"] },
    },
  },
  {
    $sort: { changedAt: -1 },
  },
  {
    $group: {
      _id: "$issueID",
      latestRecord: { $first: "$$ROOT" },
    },
  },
  {
    $replaceRoot: { newRoot: "$latestRecord" },
  },
  {
    $lookup: {
      from: "issues",
      localField: "issueID",
      foreignField: "_id",
      as: "issueDetails",
    },
  },
  {
    $unwind: "$issueDetails",
  },
  {
    $project: {
      status: 1,
      handledBy: 1,
      lastStatus: "$status",
      lastUpdated: "$changedAt",
      issueDetails: 1,
    },
  },
]);
const issues = historyRecords.map((record) => ({
  ...record.issueDetails,
  status: record.status,
  handledBy: record.handledBy,
  lastStatus: record.lastStatus,
  lastUpdated: record.lastUpdated,
  isRejected: record.status === "Rejected",
}));


    res.status(200).json({ success: true, issues });
  } catch (error) {
    console.error("Error fetching handled issues:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getEscalatedIssues = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // fetch issues that are escalated to level >= 2 and still open
    const issues = await IssueModel.find({ escalationLevel: { $gte: 2 }, status: { $in: ["Reported", "In Progress", "Pending"] } })
      .populate("citizenId", "fullName")
      .lean();

    // For each issue, find the most recent status history record that includes who escalated it (changedBy)
    const enhanced = await Promise.all(
      issues.map(async (issue: any) => {
        const hist = await IssueStatusHistoryModel.findOne({ issueID: issue._id, changedBy: { $ne: null } })
          .sort({ changedAt: -1 })
          .populate("changedBy", "fullName email")
          .lean();
        return {
          ...issue,
          escalatedBy: hist ? (hist.changedBy ? hist.changedBy : null) : null,
        };
      })
    );

    res.status(200).json({ success: true, issues: enhanced });
  } catch (err) {
    console.error("Error fetching escalated issues:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getEscalatedIssuesCount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // count only issues that are escalated and still open
    const count = await IssueModel.countDocuments({ escalationLevel: { $gte: 2 }, status: { $in: ["Reported", "In Progress", "Pending"] } });
    res.status(200).json({ success: true, count });
  } catch (err) {
    console.error("Error fetching escalated issues count:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const assignIssueToAdmin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.adminId;
    const { issueid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(issueid)) {
      res.status(400).json({ message: "Invalid issue ID format" });
      return;
    }

    const admin = await AdminModel.findById(adminId).lean();
    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const issue = await IssueModel.findById(issueid);
    if (!issue) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }

    console.log(`Admin ${adminId} (level ${(admin as any).accessLevel}) trying to take issue ${issueid} (level ${(issue as any).escalationLevel || 1})`);

    if ((admin as any).accessLevel < (issue as any).escalationLevel) {
      res.status(403).json({ message: "Insufficient admin level to take this issue" });
      return;
    }

    issue.handledBy = new mongoose.Types.ObjectId(adminId!);
    issue.escalatedTo = new mongoose.Types.ObjectId(adminId!);
    issue.status = "In Progress";

    await issue.save();

    await IssueStatusHistoryModel.create({
      issueID: issue._id,
      status: "In Progress",
      handledBy: new mongoose.Types.ObjectId(adminId!),
      changedBy: new mongoose.Types.ObjectId(adminId!),
      changedAt: new Date(),
    });

    console.log(`Issue ${issueid} assigned to admin ${adminId}`);

    res.status(200).json({ success: true, message: "Issue assigned to you", issue });
  } catch (err) {
    console.error("Error assigning issue to admin:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const escalateIssue = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.adminId;
    const { issueid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(issueid)) {
      res.status(400).json({ message: "Invalid issue ID format" });
      return;
    }

    const issue = await IssueModel.findById(issueid);
    if (!issue) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }

    console.log(`Admin ${adminId} requested escalation for issue ${issueid}. Current level: ${(issue as any).escalationLevel || 1}`);

    // escalate to next level (max handled by ESCALATION logic elsewhere)
    issue.escalationLevel = (issue as any).escalationLevel ? (issue as any).escalationLevel + 1 : 2;
    issue.status = "Pending";
    issue.handledBy = null;
    issue.escalatedTo = null;

    await issue.save();

    await IssueStatusHistoryModel.create({
      issueID: issue._id,
      status: "Pending",
      handledBy: null,
      changedBy: new mongoose.Types.ObjectId(adminId!),
      changedAt: new Date(),
    });

    console.log(`Issue ${issueid} escalated to level ${issue.escalationLevel}`);

    res.status(200).json({ success: true, message: "Issue escalated", issue });
  } catch (err) {
    console.error("Error escalating issue:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const deleteIssueByAdmin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const loggedInAdminId = req.adminId; // from auth middleware
    const { issueid } = req.params;

    // Validate issueid format
    if (!mongoose.Types.ObjectId.isValid(issueid)) {
      res.status(400).json({ message: "Invalid issue ID format" });
      return;
    }
    // If allowing any admin to delete:

    const result = await IssueModel.deleteOne({ _id: issueid });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: "Issue not found or unauthorized" });
      return;
    }
    res.json({ message: "Deleted Successfully!" });
  } catch (error) {
    console.error("Error deleting issue:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
