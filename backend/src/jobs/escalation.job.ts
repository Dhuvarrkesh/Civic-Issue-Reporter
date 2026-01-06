import { IssueModel } from "../models/issue.model";
import { IssueStatusHistoryModel } from "../models/issueStatusHistory.model";
import { AdminModel } from "../models/admin.model";

const ESCALATION_DAYS = Number(process.env.ESCALATION_DAYS) || 7;
const MAX_ESCALATION_LEVEL = Number(process.env.MAX_ESCALATION_LEVEL) || 2;
const CHECK_INTERVAL_MS = Number(process.env.ESCALATION_CHECK_INTERVAL_MS) || 1000 * 60 * 60 * 24; // default 24h

export const startEscalationJob = () => {
  console.log("Escalation job started, checking every", CHECK_INTERVAL_MS, "ms");

  const run = async () => {
    try {
      const thresholdDate = new Date(Date.now() - ESCALATION_DAYS * 24 * 60 * 60 * 1000);

      // find open issues that have not been updated since thresholdDate
      const issuesToEscalate = await IssueModel.find({
        status: { $in: ["Reported", "In Progress", "Pending"] },
        updatedAt: { $lte: thresholdDate },
      }).lean();

      for (const iss of issuesToEscalate) {
        if ((iss as any).escalationLevel >= MAX_ESCALATION_LEVEL) continue;

        // increment escalation level
        await IssueModel.findByIdAndUpdate(iss._id, {
          $inc: { escalationLevel: 1 },
          status: "Pending",
          // clear handledBy so higher admins can pick it
          handledBy: null,
          escalatedTo: null,
        });

        // record in status history (system escalator)
        await IssueStatusHistoryModel.create({
          issueID: iss._id,
          status: "Pending",
          handledBy: null,
          changedBy: null,
          changedAt: new Date(),
        });

        console.log(`Escalated issue ${iss._id} to next level`);
        // TODO: send notification to higher level admins (out of scope for now)
      }
    } catch (err) {
      console.error("Error running escalation job:", err);
    }
  };

  // run immediately and then on interval
  run();
  setInterval(run, CHECK_INTERVAL_MS);
};
