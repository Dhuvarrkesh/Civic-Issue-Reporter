import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { VITE_BACKEND_URL } from "../config/config";
import HeaderAfterAuth from "../components/HeaderAfterAuth";
import { motion } from "framer-motion";
import Player from "lottie-react";
import starloader from "../assets/animations/starloder.json";
import { useLoader } from "../contexts/LoaderContext";

interface EscIssue {
  _id: string;
  title: string;
  description: string;
  location: { address: string; latitude: number; longitude: number };
  reportedBy: string;
  reportedAt: string;
  status: string;
  escalationLevel?: number;
  escalatedTo?: string | null;
  escalatedBy?: { fullName?: string; email?: string } | null;
}

const Escalations = () => {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<EscIssue[]>([]);
  const { hideLoader } = useLoader();

  useEffect(() => {
    let mounted = true;
    const fetchEsc = async () => {
      try {
        const res = await fetch(`${VITE_BACKEND_URL}/api/v1/admin/escalated-issues`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("Failed to fetch escalations", data.message || data);
          if (mounted) setIssues([]);
        } else {
          if (mounted) setIssues(data.issues || []);
        }
      } catch (err) {
        console.error("Error fetching escalations", err);
        if (mounted) setIssues([]);
      } finally {
        if (mounted) {
          setLoading(false);
          hideLoader();
        }
      }
    };

    fetchEsc();
    const interval = setInterval(fetchEsc, 15000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'escalationUpdate') fetchEsc();
    };
    window.addEventListener('storage', onStorage);
    return () => { mounted = false; clearInterval(interval); window.removeEventListener('storage', onStorage); };
  }, [hideLoader]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-green-100 text-green-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const takeIssue = async (issueId: string) => {
    try {
      const res = await fetch(`${VITE_BACKEND_URL}/api/v1/admin/issue/${issueId}/assign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to assign issue");
      } else {
        setIssues((prev) => prev.filter((i) => i._id !== issueId));
        alert("Issue assigned to you");
      }
    } catch (err) {
      console.error("Error assigning issue", err);
      alert("Failed to assign issue");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white">
        <Player autoplay loop animationData={starloader} style={{ height: "200px", width: "200px" }} />
        <p className="text-muted-foreground mt-4">Fetching escalated issues...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="min-h-screen bg-[#f3f6f8]">
      <HeaderAfterAuth />
      <div className="pt-20 container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0577b7] ">Escalations</h1>
            <p className="text-muted-foreground mt-2">Issues escalated to higher level admins</p>
          </div>
        </div>

        <div className="rounded-md border bg-white shadow-lg text-slate-500 pl-6 pr-6 hover:shadow-xl transition-shadow duration-300 ">
          <Table>
            <TableCaption>Escalated issues.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escalated To</TableHead>
                <TableHead>Escalated By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue._id}>
                  <TableCell className="font-medium">{issue.title}</TableCell>
                  <TableCell>{(issue.location as any)?.address}</TableCell>
                  <TableCell className="text-center">{issue.escalationLevel || 2}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
                  </TableCell>
                  <TableCell>{issue.escalatedTo || "-"}</TableCell>
                  <TableCell>{issue.escalatedBy ? (issue.escalatedBy.fullName || issue.escalatedBy.email) : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button variant="secondary" onClick={() => takeIssue(issue._id)}>Take Issue</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No escalated issues.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  );
};

export default Escalations;
