import { useState } from "react";
import { Mail } from "lucide-react";
import { StorySection } from "./StorySection";
import { supabase } from "../../lib/supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | busy | done | duplicate | error

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setStatus("error"); return; }

    setStatus("busy");
    const { error } = await supabase.from("newsletter_signups").insert({ email: email.trim().toLowerCase() });
    if (!error) {
      setStatus("done");
    } else if (error.code === "23505") {
      setStatus("duplicate");
    } else {
      setStatus("error");
    }
  }

  return (
    <StorySection
      eyebrow="Stay informed"
      headline="Get Pulse Updates"
      body={<p>Occasional updates on new representatives, features, and what citizens are demanding — no spam.</p>}
    >
      {status === "done" ? (
        <div className="hs-newsletter-confirm"><Mail size={16} /> You're on the list — thank you.</div>
      ) : status === "duplicate" ? (
        <div className="hs-newsletter-confirm"><Mail size={16} /> That email is already on the list.</div>
      ) : (
        <form className="hs-newsletter-form" onSubmit={submit}>
          <input
            type="email"
            className="mw-form-input hs-newsletter-input"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          />
          <button className="mw-btn mw-btn-primary hs-newsletter-btn" type="submit" disabled={status === "busy"}>
            {status === "busy" ? "Joining…" : "Subscribe"}
          </button>
        </form>
      )}
      {status === "error" && <div className="hs-newsletter-error">Enter a valid email address.</div>}
    </StorySection>
  );
}

export default Newsletter;
