import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginUser, getUserRole } from "@/lib/firebaseAuth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin@pharma.com";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setLoading(true);
    try {
      const user = await loginUser(email, password);
      if (email === ADMIN_EMAIL) {
        await setDoc(doc(db, "users", user.uid), { email, name: "Admin", role: "admin", createdAt: Date.now() }, { merge: true });
      }
      const role = await getUserRole(user.uid);
      navigate(role === "admin" ? "/admin" : "/mr");
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card-glass w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Pharma Field Force</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-secondary/50 border-border/40 h-12 rounded-xl"
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="bg-secondary/50 border-border/40 h-12 rounded-xl"
          />
          <Button size="lg" className="w-full btn-glow h-12 rounded-xl gap-2" onClick={handleLogin} disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Admin: {ADMIN_EMAIL} · MRs: created by admin
        </p>
      </div>
    </div>
  );
};

export default Login;
