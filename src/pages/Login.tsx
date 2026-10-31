import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppConfig } from "@/config";

export default function Login() {
  const { siteStatus, titleText, publicSettings } = useAppConfig();
  const oauth_enable = publicSettings?.oauth_enable;
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isLoggedIn =
    siteStatus === "authenticated" || siteStatus === "private-authenticated";

  useEffect(() => {
    if (isLoggedIn) {
      window.location.href = "/admin";
    }
  }, [isLoggedIn]);

  const isFormValid = username.trim() !== "" && password.trim() !== "";

  const handleLogin = async () => {
    if (!isFormValid || isLoading) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.status === 200) {
        window.location.href = "/admin";
      } else {
        setErrorMsg(data.error || "登录失败");
      }
    } catch {
      setErrorMsg("网络错误");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      handleLogin();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      handleLogin();
    }
  };

  if (isLoggedIn) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <Card className="purcarte-blur w-full max-w-md border-(--accent-4)/50 rounded-2xl">
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-2xl font-bold theme-text-shadow">
            {titleText || "Komari Monitor"}
          </CardTitle>
          <CardDescription>登录以进入管理后台</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 px-6 pb-6">
          <div className="grid gap-1.5">
            <Input
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>
          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          <Button type="submit" disabled={isLoading || !isFormValid}>
            {isLoading ? "登录中..." : "登录"}
          </Button>
          {oauth_enable && (
            <Button
              variant="secondary"
              type="button"
              disabled={isLoading}
              onClick={() => {
                window.location.href = "/api/oauth";
              }}
            >
              GitHub 登录
            </Button>
          )}
        </form>
        <CardFooter className="justify-center pb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            返回首页
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
