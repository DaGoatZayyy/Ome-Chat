"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Profile = {
  user_id: string;
  age_verified: boolean;
  age_verified_at: string | null;
  verification_provider: string | null;
  country_code: string | null;
  interests: string[];
  banned_at: string | null;
  created_at: string;
  updated_at: string;
};
type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  profile: Profile | null;
};

export default function AdminPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setUser(session?.user ?? null);
    if (!session) {
      setLoading(false);
      setError("Sign in with an authorized admin account to continue.");
      return;
    }
    const response = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Could not load admin data.");
      setLoading(false);
      return;
    }
    setUsers(body.users ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function setAgeStatus(target: AdminUser, action: "approve_age" | "revoke_age") {
    const note = (reviewNotes[target.id] ?? "").trim();
    if (note.length < 10) {
      setError("Enter a review note of at least 10 characters before changing a status.");
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setError("Your session expired. Sign in again.");
      return;
    }
    const verb = action === "approve_age" ? "mark verified" : "revoke verification for";
    if (!window.confirm(`Are you sure you want to ${verb} ${target.email ?? target.id}? Only approve after appropriate age evidence has been reviewed.`)) return;
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: target.id, action, note }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not update account.");
      setNotice(`Updated ${target.email ?? target.id}. The decision was recorded in the audit log.`);
      setReviewNotes(prev => ({ ...prev, [target.id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = users.filter(item => {
    const q = search.toLowerCase().trim();
    return !q || item.id.toLowerCase().includes(q) || (item.email ?? "").toLowerCase().includes(q);
  });

  return (
    <main style={{ minHeight: "100vh", background: "#0b1020", color: "#edf2ff", padding: "32px 18px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <a href="/" style={{ color: "#a9b8d8", textDecoration: "none" }}>← OmeChat</a>
            <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>Admin panel</h1>
            <p style={{ margin: 0, color: "#a9b8d8" }}>Account directory and age-review decisions</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#a9b8d8", fontSize: 13 }}>{user?.email ?? "Not signed in"}</span>
            <button onClick={() => void load()} style={buttonStyle}>Refresh</button>
            <button onClick={() => router.push("/")} style={buttonStyle}>Home</button>
          </div>
        </header>

        <section style={{ border: "1px solid #34415e", borderRadius: 12, padding: 16, marginBottom: 18, background: "#121a2d" }}>
          <strong>Review carefully</strong>
          <p style={{ color: "#c3cde2", lineHeight: 1.55, marginBottom: 0 }}>
            Only mark an account verified after appropriate age evidence has been reviewed under your verification policy. Every change requires a note and is written to an audit log. Admin access is controlled by the server-side ADMIN_EMAILS setting.
          </p>
        </section>

        {error && <p role="alert" style={{ background: "#4a202a", padding: 12, borderRadius: 8 }}>{error}</p>}
        {notice && <p role="status" style={{ background: "#183a31", padding: 12, borderRadius: 8 }}>{notice}</p>}

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or user ID…" aria-label="Search users" style={{ ...fieldStyle, marginBottom: 16, maxWidth: 500 }} />

        {loading ? <p>Loading accounts…</p> : (
          <div style={{ overflowX: "auto", border: "1px solid #34415e", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920, background: "#121a2d" }}>
              <thead><tr>{["Account", "User ID", "Profile", "Age status", "Review action"].map(label => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>
                {visible.map(item => {
                  const profile = item.profile;
                  const verified = profile?.age_verified === true;
                  return <tr key={item.id}>
                    <td style={tdStyle}><strong>{item.email ?? "(no email)"}</strong><div style={{ color: "#a9b8d8", fontSize: 12, marginTop: 5 }}>Joined {new Date(item.created_at).toLocaleDateString()}</div></td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, maxWidth: 230, overflowWrap: "anywhere" }}>{item.id}</td>
                    <td style={tdStyle}><div>Country: {profile?.country_code ?? "—"}</div><div>Interests: {profile?.interests?.join(", ") || "—"}</div><div>Profile: {profile ? "Created" : "Missing"}</div><div>Restricted: {profile?.banned_at ? "Yes" : "No"}</div></td>
                    <td style={tdStyle}><span style={{ display: "inline-block", borderRadius: 999, padding: "5px 9px", background: verified ? "#174b3c" : "#4a3820", color: verified ? "#a4f0d2" : "#ffdfa0", fontSize: 12 }}>{verified ? "Verified" : "Not verified"}</span><div style={{ color: "#a9b8d8", fontSize: 12, marginTop: 7 }}>{profile?.verification_provider ?? "No review source"}</div>{profile?.age_verified_at && <div style={{ color: "#a9b8d8", fontSize: 12 }}>{new Date(profile.age_verified_at).toLocaleString()}</div>}</td>
                    <td style={tdStyle}>
                      <textarea value={reviewNotes[item.id] ?? ""} onChange={e => setReviewNotes(prev => ({ ...prev, [item.id]: e.target.value.slice(0, 2000) }))} placeholder="Review note (10–2000 chars)" rows={2} style={{ ...fieldStyle, minWidth: 230, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button disabled={busyId === item.id || verified || Boolean(profile?.banned_at)} onClick={() => void setAgeStatus(item, "approve_age")} style={{ ...buttonStyle, background: "#1b684d", opacity: busyId === item.id || verified || Boolean(profile?.banned_at) ? 0.5 : 1 }}>{busyId === item.id ? "Saving…" : "Mark verified"}</button>
                        <button disabled={busyId === item.id || !verified} onClick={() => void setAgeStatus(item, "revoke_age")} style={{ ...buttonStyle, background: "#74303b", opacity: busyId === item.id || !verified ? 0.5 : 1 }}>Revoke</button>
                      </div>
                    </td>
                  </tr>;
                })}
                {visible.length === 0 && <tr><td colSpan={5} style={tdStyle}>No accounts match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: "#a9b8d8", fontSize: 12, marginTop: 14 }}>Showing up to 200 most recent Auth accounts. User metadata is not used as age-verification evidence.</p>
      </div>
    </main>
  );
}

const buttonStyle: React.CSSProperties = { border: "1px solid #445473", borderRadius: 8, background: "#24314a", color: "#edf2ff", padding: "9px 12px", cursor: "pointer" };
const fieldStyle: React.CSSProperties = { boxSizing: "border-box", width: "100%", border: "1px solid #445473", borderRadius: 8, background: "#0d1425", color: "#edf2ff", padding: 10 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: 12, borderBottom: "1px solid #34415e", color: "#a9b8d8", fontSize: 12, textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { verticalAlign: "top", padding: 12, borderBottom: "1px solid #293650", fontSize: 13, lineHeight: 1.5 };
