import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";

export function SearchSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [open, setOpen] = useState(false), [signup, setSignup] = useState(false);
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function social(provider: "google" | "lovable") {
    setBusy(true); setMessage(null);
    try { const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (r.error) setMessage(r.error.message); else if (!r.redirected) onSignedIn(); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setMessage(null);
    try {
      const r = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }) : await supabase.auth.signInWithPassword({ email, password });
      if (r.error) setMessage(r.error.message);
      else if (r.data.session) onSignedIn();
      else setMessage("Check your email to confirm your account before signing in.");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  if (!open) return <Button variant="link" size="sm" type="button" className="h-auto whitespace-normal px-0 text-left" onClick={() => setOpen(true)}>Sign in to use Google place search</Button>;
  return <div className="space-y-2 border-l-2 border-border pl-3">
    <Button className="google-auth w-full" variant="outline" type="button" disabled={busy} onClick={() => social("google")}><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continue with Google</Button>
    <Button className="lovable-auth-button w-full" type="button" disabled={busy} onClick={() => social("lovable")}>Continue with Lovable</Button>
    <div className="space-y-1"><Label htmlFor="search-email">Email</Label><Input id="search-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="search-password">Password</Label><Input id="search-password" type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></div>
    <Button type="button" className="w-full" disabled={busy || !email || password.length < 6} onClick={submit}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="link" size="sm" onClick={() => { setSignup(!signup); setMessage(null); }}>{signup ? "Already have an account?" : "Create an account"}</Button><Button type="button" variant="link" size="sm" disabled={busy || !email} onClick={async () => { setBusy(true); const r = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setMessage(r.error?.message ?? "Check your email for a password reset link."); setBusy(false); }}>Forgot password?</Button></div>
    {message && <p role="status" className="break-words text-sm">{message}</p>}
  </div>;
}