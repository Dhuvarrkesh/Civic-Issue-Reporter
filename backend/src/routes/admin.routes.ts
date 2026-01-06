import { Router } from "express";
import {
  adminSignin,
  adminSignup,
} from "../controllers/auth-controllers/admin.auth.controller";
import { authMiddleware } from "../middlerware/auth.middleware";
import {
  deleteIssueByAdmin,
  getAdminProfile,
  getHandledIssuesByAdmin,
  updateAdminProfile,
  updateIssueStatus,
  getEscalatedIssues,
  getEscalatedIssuesCount,
  assignIssueToAdmin,
  escalateIssue,
} from "../controllers/admin.controller";
import { getIssues } from "../controllers/issues.controllers";

const router = Router();

router.post("/admin/signup", adminSignup);

router.post("/admin/signin", adminSignin);

router.get("/admin/profile/:id", authMiddleware, getAdminProfile);

router.get("/admin/issues", authMiddleware, getIssues);

router.get("/admin/handled-issues", authMiddleware, getHandledIssuesByAdmin);

router.get("/admin/escalated-issues", authMiddleware, getEscalatedIssues);
router.get("/admin/escalated-issues/count", authMiddleware, getEscalatedIssuesCount);
router.post("/admin/issue/:issueid/assign", authMiddleware, assignIssueToAdmin);
router.post("/admin/issue/:issueid/escalate", authMiddleware, escalateIssue);

router.put("/admin/:id", authMiddleware, updateAdminProfile);

router.put("/admin/issue/:id/status", authMiddleware, updateIssueStatus);

router.delete("/issue/admin/:issueid", authMiddleware, deleteIssueByAdmin);

export default router;
