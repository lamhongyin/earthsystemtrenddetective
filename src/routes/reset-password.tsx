import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/reset-password")({ head: () => ({ meta: [{ title: "Reset password — Earth System Trend Detective" }, { name: "description", content: "Reset your Earth System Trend Detective place-search account password." }, { property: "og:title", content: "Reset password — Earth System Trend Detective" }, { property: "og:description", content: "Recover access to protected Google place search." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ResetPassword });
function ResetPassword() {
  const [allowed, setAllowed] = useState(false), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("type") === "recovery") setAllowed(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") setAllowed(true); });
    return () => subscription.unsubscribe();
  }, []);
  return <main className="mx-auto max-w-md px-6 py-16 space-y-4"><h1 className="text-3xl">Reset password</h1>{!allowed ? <p>Open the password reset link from your email.</p> : done ? <p>Password updated.</p> : <form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (password !== confirm) { setMessage("Passwords do not match."); return; } setBusy(true); const r = await supabase.auth.updateUser({ password }); setMessage(r.error?.message ?? "Password updated."); setDone(!r.error); setBusy(false); }}><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /><Button disabled={busy} type="submit">Update password</Button>{message && <p role="status">{message}</p>}</form>}<Link to="/" className="text-primary underline">Return to explorer</Link></main>;
}