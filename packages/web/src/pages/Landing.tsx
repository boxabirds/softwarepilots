import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, loginUrl } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get("auth_error");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Software Pilotry</CardTitle>
          <CardDescription>
            Foundation Course — learn to oversee, verify, and take responsibility for AI-generated software.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {authError && (
            <p className="text-sm text-destructive">
              Authentication failed: {authError}. Please try again.
            </p>
          )}
          <Button asChild className="w-full">
            <a href={loginUrl()}>Sign in with GitHub</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
