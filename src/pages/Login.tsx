import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      // Seed admin role doc if admin email
      if (email === ADMIN_EMAIL) {
        await setDoc(doc(db, "users", user.uid), { email, name: "Admin", role: "admin", createdAt: Date.now() }, { merge: true });
      }
      const role = await getUserRole(user.uid);
      if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/mr");
      }
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl shadow-primary/10 border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pharma Field Force Tracker</CardTitle>
          <CardDescription>Login with your credentials</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Button size="lg" className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Admin: {ADMIN_EMAIL} · MRs: created by admin
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
