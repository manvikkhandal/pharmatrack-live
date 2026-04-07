import { useNavigate } from "react-router-dom";
import { Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pharma Field Force Tracker</CardTitle>
          <CardDescription>Select your role to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" className="w-full gap-2" onClick={() => navigate("/admin")}>
            <Shield className="h-5 w-5" /> Login as Admin
          </Button>
          <Button size="lg" variant="outline" className="w-full gap-2" onClick={() => navigate("/mr")}>
            <User className="h-5 w-5" /> Login as MR
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
