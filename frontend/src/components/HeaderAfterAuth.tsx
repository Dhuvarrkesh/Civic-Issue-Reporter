import { Link } from "react-router-dom";
import { Button } from "./ui/button.tsx";
import { LogIn, LogOut, Shield, LayoutDashboard } from "lucide-react";
import civicIssueLogo from "../assets/civic-issue.png";
import { useAuth } from "../contexts/AuthContext.tsx";
import { useEffect, useState } from "react";
import { VITE_BACKEND_URL } from "../config/config";

type HeaderProps = {
  onFeaturesClick?: () => void;
  onHowItWorksClick?: () => void;
};

const Header: React.FC<HeaderProps> = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <header
      className="
        w-full
        fixed top-0 left-0 right-0
        z-50
        bg-white/30
        backdrop-blur-md
        border-b border-gray-200/50
        supports-[backdrop-filter]:bg-white/30
      "
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-17 h-17 rounded-lg">
              <img src={civicIssueLogo} alt="civicIssueLogo" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                CivicIssueRepoter
              </h1>
              <p className="text-xs text-muted-foreground">
                Building Better Communities
              </p>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome,{" "}
                  {user?.fullName ? user.fullName.split(" ")[0] : "Guest"}!
                </span>
                <Link to={user.role === "citizen" ? "/citizen" : "/admin"}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 text-slate-500"
                  >
                    <LayoutDashboard className="h-4 w-4 text-blue-700" />
                    <span className="hidden sm:block">Dashboard</span>
                  </Button>
                </Link>
                {user.role === "admin" && (user as any).accessLevel >= 2 && (
                  <Link to="/admin/escalations">
                    <Button variant="outline" size="sm" className="flex items-center space-x-2 text-slate-500">
                      <span className="hidden sm:block">Escalations</span>
                      <span className="inline-flex items-center justify-center px-2 py-1 ml-2 rounded-full bg-red-100 text-red-800 text-xs">
                        <EscalationBadge />
                      </span>
                    </Button>
                  </Link>
                )}
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2 text-slate-500"
                >
                  <LogOut className="h-4 w-4 text-blue-700" />
                  <span className="hidden sm:block">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link to="/signin">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex items-center space-x-2"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button
                    size="sm"
                    className="flex items-center space-x-2 civic-gradient border-0 text-white hover:opacity-90"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Sign Up</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


function EscalationBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(`${VITE_BACKEND_URL}/api/v1/admin/escalated-issues/count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        });
        const data = await res.json();
        if (mounted && res.ok) {
          setCount(data.count || 0);
        }
      } catch (err) {
        console.error("Failed fetching escalations count", err);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "escalationUpdate") {
        fetchCount();
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <>{count}</>;
}

export default Header;
