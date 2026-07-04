import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { TAB_PATHS, tabFromPath, isKnownPath } from "./lib/routing";
import { Search, MapPin, ChevronRight, ThumbsUp, ThumbsDown, Plus, X, TrendingUp, Users, CheckCircle2, ArrowUpRight, MessageSquare, CornerDownRight, Paperclip } from "lucide-react";
import logo from "./assets/logo.png";
import { REPS } from "./data/reps";
import { PARTY_COLORS, PARTY_LOGOS } from "./data/parties";
import {
  REGIONS, LGAS_BY_STATE, SEN_DISTRICTS, FED_CONSTITUENCIES, STATE_CONSTITUENCIES,
  regionOf, constituencyMatches, repCoversArea,
} from "./data/geography";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./hooks/useAuth";
import { usePlatform } from "./platform/usePlatform";

// Lazy-loaded: keeps the ~800 lines of homepage storytelling sections out of the main bundle
// until they're actually needed, and splits it into its own chunk (see the existing >500kB build
// warning this addresses).
const HomepageStory = lazy(() => import("./components/home/HomepageStory.jsx"));

/* ---------------------------------------------------------------
   SAMPLE DATA — illustrative only, fictional names, not real people
--------------------------------------------------------------- */


// Phase 1 directory scope: Governor and State Assembly (State Level) + Senate and House of Reps (Federal Level).
// President, LG Chairman, and Councilor remain in the data (so Demands Board links still resolve) but are
// excluded from the Representatives tab/filters until Phase 2, per your direction.
const CHAMBER_INFO = {
  Senate: { label: "Senator", level: "Federal Level" },
  "House of Reps": { label: "Member, House of Representatives", level: "Federal Level" },
  Governor: { label: "Governor", level: "State Level" },
  "State Assembly": { label: "Member, State House of Assembly", level: "State Level" },
};
const PHASE1_CHAMBERS = Object.keys(CHAMBER_INFO);


// Level/chamber color coding used on the level tag across cards and profiles.
const CHAMBER_TAG_COLORS = {
  Senate: "#B5423A",           // Senator — red
  "House of Reps": "#1F5E3F",  // other federal reps — green
  Governor: "#2C5F8A",         // state level — blue
  "State Assembly": "#2C5F8A", // state level — blue
};

function repTitleLabel(rep, info) {
  if (rep.role) return rep.role;
  if (rep.chamber === "Governor") return `Governor of ${rep.state} State`;
  return info ? info.label : rep.chamber;
}



// Aspirants populate once real INEC-certified candidate lists are sourced for an upcoming race —
// left empty rather than filled with placeholder names now that the directory carries real officials.
const ASPIRANTS = [];

const CHAMBERS = ["All", "Governor", "Senate", "House of Reps", "State Assembly"];

const DEMAND_STATUS_STAMP = {
  open: "stamp-verdant",
  acknowledged: "stamp-brass",
  delivered: "stamp-navy",
};

// Stewardship entries — reps (once claimed) post what they've delivered; citizens verify the claim.
// Starts empty like demands/threads — this is a real accountability record, not seeded content.
const STEWARDSHIP = [];





// The signed-in user's profile now comes from the real registration flow (AuthModal, below)
// rather than a hardcoded stub — see the `user` state in the main app component.

const STAMP_COLOR = {
  "ON WATCH": "stamp-verdant",
  "VERIFIED": "stamp-brass",
};

/* ---------------------------------------------------------------
   COMPONENTS
--------------------------------------------------------------- */

function CountdownTimer({ label, date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(date).getTime();
  const diff = target - now;
  const isPast = diff <= 0;
  const days = Math.max(0, Math.floor(diff / 86400000));
  const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));
  const seconds = Math.max(0, Math.floor((diff % 60000) / 1000));

  return (
    <div className="mw-countdown">
      <div className="mw-countdown-label">{label}</div>
      {isPast ? (
        <div className="mw-countdown-past">Election day has passed</div>
      ) : (
        <div className="mw-countdown-digits">
          <div className="mw-countdown-unit"><span>{days}</span><label>Days</label></div>
          <div className="mw-countdown-unit"><span>{String(hours).padStart(2, "0")}</span><label>Hrs</label></div>
          <div className="mw-countdown-unit"><span>{String(minutes).padStart(2, "0")}</span><label>Min</label></div>
          <div className="mw-countdown-unit"><span>{String(seconds).padStart(2, "0")}</span><label>Sec</label></div>
        </div>
      )}
      <div className="mw-countdown-date">{new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  );
}

function VotePoll() {
  const [counts, setCounts] = useState({ yes: 2847, no: 412 });
  const [voted, setVoted] = useState(null);

  function vote(choice) {
    if (voted) return;
    setVoted(choice);
    setCounts((prev) => ({ ...prev, [choice]: prev[choice] + 1 }));
  }

  const total = counts.yes + counts.no;
  const yesPct = total ? Math.round((counts.yes / total) * 100) : 0;
  const noPct = total ? 100 - yesPct : 0;

  return (
    <div className="mw-vote-poll">
      <div className="mw-vote-poll-question">Will you vote?</div>
      <div className="mw-vote-poll-buttons">
        <button className={`mw-vote-poll-btn mw-vote-poll-yes ${voted === "yes" ? "mw-vote-poll-chosen" : ""}`} onClick={() => vote("yes")} disabled={!!voted}>
          <ThumbsUp size={16} />
          <span>Yes</span>
          <b>{counts.yes}{total > 0 ? ` (${yesPct}%)` : ""}</b>
        </button>
        <button className={`mw-vote-poll-btn mw-vote-poll-no ${voted === "no" ? "mw-vote-poll-chosen" : ""}`} onClick={() => vote("no")} disabled={!!voted}>
          <ThumbsDown size={16} />
          <span>No</span>
          <b>{counts.no}{total > 0 ? ` (${noPct}%)` : ""}</b>
        </button>
      </div>
    </div>
  );
}


function NigeriaMap({ repsData, onSelectState, hoveredState, onHoverState, selectedState }) {
  const counts = useMemo(() => {
    const c = {};
    repsData.forEach((r) => { c[r.state] = (c[r.state] || 0) + 1; });
    return c;
  }, [repsData]);
  const max = Math.max(1, ...Object.values(counts));

  // The state-path data is ~65KB of raw SVG path strings -- lazy-imported here instead of at
  // module load, so it's only ever fetched when a visitor actually opens the PulseMap tab.
  const [mapData, setMapData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    import("./data/nigeriaMapPaths").then((mod) => { if (!cancelled) setMapData(mod); });
    return () => { cancelled = true; };
  }, []);

  if (!mapData) {
    return (
      <div className="mw-map-wrap mw-map-loading" aria-busy="true" aria-label="Loading map">
        <div className="mw-map-skeleton" />
      </div>
    );
  }

  return (
    <div className="mw-map-wrap">
      <svg className="mw-map-svg" viewBox={mapData.NIGERIA_MAP_VIEWBOX} role="img" aria-label="Map of Nigeria by state">
        {mapData.NIGERIA_STATE_PATHS.map(({ state, d }) => {
          const count = counts[state] || 0;
          const intensity = count / max;
          const isHovered = hoveredState === state;
          const isSelected = selectedState === state;
          return (
            <path
              key={state}
              d={d}
              className={`mw-map-path ${isSelected ? "mw-map-path-selected" : ""}`}
              style={{
                fill: count === 0 ? "var(--paper)" : `rgba(31,94,63,${0.18 + intensity * 0.72})`,
                filter: isHovered && !isSelected ? "brightness(0.88)" : "none",
              }}
              onClick={() => onSelectState(state)}
              onMouseEnter={() => onHoverState && onHoverState(state)}
              onMouseLeave={() => onHoverState && onHoverState(null)}
              tabIndex={0}
              role="button"
              aria-label={`${state} — ${count} tracked`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectState(state); }}
            />
          );
        })}
      </svg>
      <div className="mw-map-legend">
        <span>Fewer tracked</span>
        <span className="mw-map-legend-bar" />
        <span>More tracked</span>
      </div>
    </div>
  );
}


function Stamp({ text, tone = "stamp-verdant", size = "" }) {
  return (
    <div className={`stamp ${tone} ${size}`}>
      <span>{text}</span>
    </div>
  );
}

function Bar({ label, value, tone }) {
  return (
    <div className="mw-bar-wrap">
      <div className="mw-bar-label">
        <span>{label}</span>
        <span className="mw-bar-value">{value}%</span>
      </div>
      <div className="mw-bar-track">
        <div className={`mw-bar-fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PhotoPlaceholder({ initials, size = "", photoUrl }) {
  if (photoUrl) {
    return (
      <div className={`mw-photo mw-photo-real ${size}`}>
        <img src={photoUrl} alt="" />
      </div>
    );
  }
  return (
    <div className={`mw-photo ${size}`}>
      <span>{initials}</span>
      <div className="mw-photo-tag">Photo</div>
    </div>
  );
}

function PartyBadge({ party, size = "" }) {
  const logo = PARTY_LOGOS[party];
  if (logo) {
    return (
      <div className={`mw-party-logo ${size}`} title={party}>
        <img src={logo} alt={`${party} logo`} />
      </div>
    );
  }
  const color = PARTY_COLORS[party] || "#4A5A66";
  return (
    <div className={`mw-party-badge ${size}`} style={{ background: color }} title={`${party} — placeholder logo`}>
      <span>{party}</span>
    </div>
  );
}

function RepCard({ rep, onOpen, isClaimed }) {
  const initials = rep.name.replace(/^(Sen\.|Rep\.|Gov\.|Hon\.)\s/, "").split(" ").map(w => w[0]).join("").slice(0, 2);
  const info = CHAMBER_INFO[rep.chamber];
  const displayStatus = isClaimed ? "VERIFIED" : "ON WATCH";
  return (
    <button className="mw-card" onClick={() => onOpen(rep)}>
      <div className="mw-card-top">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <PhotoPlaceholder initials={initials} photoUrl={rep.photoUrl} />
          <div className="mw-party-col">
            <PartyBadge party={rep.party} />
            <span className="mw-party-name">{rep.party}</span>
          </div>
        </div>
        <Stamp text={displayStatus} tone={STAMP_COLOR[displayStatus]} size="stamp-sm" />
      </div>
      <h3 className="mw-card-name">{rep.name}</h3>
      {info && <div className="mw-rep-full-title">{repTitleLabel(rep, info)}</div>}
      <div className="mw-card-meta">
        {info && <span className="mw-level-tag" style={{ background: CHAMBER_TAG_COLORS[rep.chamber], color: "#fff", borderColor: CHAMBER_TAG_COLORS[rep.chamber] }}>{info.level}</span>}
      </div>
      <div className="mw-card-meta mw-card-meta-sub">
        <MapPin size={11} /><span>{rep.constituency} · {rep.lga} LGA, {rep.town}, {rep.state} State</span>
      </div>
      <div className="mw-term-row">
        Elected {rep.electedYear} · Term {rep.termStart}–{rep.termEnd} · {rep.termNumber}
      </div>
      <div className="mw-card-bars">
        <Bar label={rep.chamber === "Governor" ? "State Projects" : "Constituency Projects"} value={rep.presence} tone="fill-brass" />
        <Bar label="Approval" value={rep.approval} tone="fill-verdant" />
      </div>
      <div className="mw-card-footer">
        <span className="mw-demand-count"><Users size={13} /> {rep.demands} demands filed</span>
        <ChevronRight size={16} />
      </div>
    </button>
  );
}

function PulseVote({ label, question, value, tone, voted, onVote, upLabel, downLabel }) {
  return (
    <div className="mw-pulse-block">
      <Bar label={label} value={value} tone={tone} />
      <div className="mw-pulse-question">{question}</div>
      {voted ? (
        <div className={`mw-pulse-recorded ${voted === "up" ? "mw-pulse-up" : "mw-pulse-down"}`}>
          <CheckCircle2 size={13} /> Your response: {voted === "up" ? upLabel : downLabel} — thanks for weighing in
        </div>
      ) : (
        <div className="mw-pulse-buttons">
          <button className="mw-pulse-btn mw-pulse-btn-up" onClick={() => onVote("up")}><ThumbsUp size={13} /> {upLabel}</button>
          <button className="mw-pulse-btn mw-pulse-btn-down" onClick={() => onVote("down")}><ThumbsDown size={13} /> {downLabel}</button>
        </div>
      )}
    </div>
  );
}

function RepProfilePage({ rep, onBack, onFileDemand, onStateClick, onViewDiscussion, onViewStewardship, voteState, onVote, isClaimed, isOwner, isActingAsRep, claimStatus, onClaim, onResumeView, onExitView, repDemands, onAcknowledgeDemand, repThreads, commentsList }) {
  const platform = usePlatform();
  if (!rep) return null;
  const initials = rep.name.replace(/^(Sen\.|Rep\.|Gov\.|Hon\.)\s/, "").split(" ").map(w => w[0]).join("").slice(0, 2);
  const v = voteState || {};
  const info = CHAMBER_INFO[rep.chamber];
  const displayStatus = isClaimed ? "VERIFIED" : "ON WATCH";

  const coveredLgas = (() => {
    if (rep.chamber === "Governor") return LGAS_BY_STATE[rep.state] || [];
    if (rep.chamber === "Senate") {
      const d = SEN_DISTRICTS.find(([s, name]) => s === rep.state && constituencyMatches(rep.constituency, name));
      return d ? d[2] : [];
    }
    if (rep.chamber === "House of Reps") {
      const d = FED_CONSTITUENCIES.find(([s, name]) => s === rep.state && constituencyMatches(rep.constituency, name));
      return d ? d[2] : [];
    }
    return [];
  })();
  // State Assembly seats are the specific, numbered constituency itself (e.g. "Port Harcourt III"),
  // not just the broader LGA it sits in — showing the LGA alone loses that specificity.
  const isSpecificSeat = rep.chamber === "State Assembly";
  const specificSeatParentLgas = isSpecificSeat
    ? (() => {
        const d = STATE_CONSTITUENCIES.find(([s, name]) => s === rep.state && constituencyMatches(rep.constituency, name));
        return d ? d[2] : [];
      })()
    : [];

  return (
    <div className="mw-page">
      <button className="mw-back-btn" onClick={onBack}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Representatives</button>

      <div className="mw-page-card">
        <div className="mw-section-eyebrow">Roster Profile</div>
        <div className="mw-modal-header">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <PhotoPlaceholder initials={initials} size="mw-photo-lg" photoUrl={rep.photoUrl} />
            <div className="mw-party-col">
              <PartyBadge party={rep.party} size="mw-party-badge-lg" />
              <span className="mw-party-name">{rep.party}</span>
            </div>
          </div>
          <div>
            <h2 className="mw-modal-name">{rep.name}</h2>
            {info && <div className="mw-rep-full-title">{repTitleLabel(rep, info)}</div>}
            <div className="mw-card-meta">
              {info && <span className="mw-level-tag" style={{ background: CHAMBER_TAG_COLORS[rep.chamber], color: "#fff", borderColor: CHAMBER_TAG_COLORS[rep.chamber] }}>{info.level}</span>}
              {isClaimed && <span className="mw-verified-badge"><CheckCircle2 size={11} /> Verified Rep</span>}
            </div>
            <div className="mw-card-meta mw-card-meta-sub">
              <MapPin size={11} />
              <span>{rep.constituency} ·</span>
              <button className="mw-state-link" onClick={() => onStateClick(rep.state)}>{rep.state} State</button>
            </div>
          </div>
          <Stamp text={displayStatus} tone={STAMP_COLOR[displayStatus]} />
        </div>

        <div className="mw-form-hint" style={{ margin: "4px 0 16px" }}>
          Claims are reviewed manually by MandateWatch before a profile is marked verified — only the reviewed, approved account can reply as this rep.
        </div>
        {!isClaimed && (
          <button className="mw-btn mw-btn-ghost mw-verify-toggle" onClick={onClaim} disabled={claimStatus === "pending"}>
            {claimStatus === "pending" ? "Claim submitted — pending review" : claimStatus === "rejected" ? "Claim declined — submit again" : "Claim & Verify This Profile"}
          </button>
        )}
        {isClaimed && isOwner && isActingAsRep && (
          <button className="mw-btn mw-btn-primary mw-verify-toggle" onClick={onExitView}>Acting as Verified Rep — Exit</button>
        )}
        {isClaimed && isOwner && !isActingAsRep && (
          <button className="mw-btn mw-btn-ghost mw-verify-toggle" onClick={onResumeView}>Continue as Verified Rep</button>
        )}

        <div className="mw-file-stats" style={{ margin: "20px 0" }}>
          <div><span className="mw-file-num">{rep.termStart}–{rep.termEnd}</span><span className="mw-file-label">term</span></div>
          <div><span className="mw-file-num">{rep.electedYear}</span><span className="mw-file-label">elected</span></div>
          <div><span className="mw-file-num">{rep.termNumber}</span><span className="mw-file-label">no. of term</span></div>
        </div>

        <PulseVote
          label={rep.chamber === "Governor" ? "State Projects" : "Constituency Projects"}
          question="Has this rep delivered a visible project or intervention in your area?"
          value={rep.presence}
          tone="fill-brass"
          voted={v.presence}
          onVote={(dir) => onVote("presence", dir)}
          upLabel="Yes, delivered"
          downLabel="No, nothing seen"
        />

        <PulseVote
          label="Approval rating"
          question="Do you approve of how this rep is performing?"
          value={rep.approval}
          tone="fill-verdant"
          voted={v.approval}
          onVote={(dir) => onVote("approval", dir)}
          upLabel="Approve"
          downLabel="Disapprove"
        />

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Top demand from constituents</div>
          <p className="mw-demand-text">"{rep.topDemand}"</p>
        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Case file</div>
          <div className="mw-file-stats">
            <div><span className="mw-file-num">{rep.demands}</span><span className="mw-file-label">demands filed</span></div>
            <div><span className="mw-file-num">{rep.lga}</span><span className="mw-file-label">LGA</span></div>
            <div><span className="mw-file-num">{rep.town}</span><span className="mw-file-label">home town</span></div>
          </div>

        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">
            {isSpecificSeat ? "Area represented" : `LGAs covered (${coveredLgas.length})`}
          </div>
          {isSpecificSeat ? (
            <div className="mw-lga-chip-list">
              <span className="mw-lga-chip mw-lga-chip-specific">{rep.constituency}</span>
              {specificSeatParentLgas.length > 0 && (
                <span className="mw-form-hint" style={{ margin: 0, alignSelf: "center" }}>
                  part of {specificSeatParentLgas.join(", ")} LGA
                </span>
              )}
            </div>
          ) : coveredLgas.length > 0 ? (
            <div className="mw-lga-chip-list">
              {coveredLgas.map((l) => <span key={l} className="mw-lga-chip">{l}</span>)}
            </div>
          ) : (
            <div className="mw-form-hint">
              Coverage not resolved for this constituency name against the official delimitation data —
              see PRD §6 for why some constituencies (mainly State Assembly, ward-level ones) aren't fully mapped yet.
            </div>
          )}
        </div>

        <div className="mw-modal-actions" style={{ marginBottom: 10 }}>
          <button className="mw-btn mw-btn-ghost" style={{ flex: 1 }} onClick={() => onFileDemand(rep.id)}>{platform.cta.fileADemand}</button>
          <button className="mw-btn mw-btn-ghost" style={{ flex: 1 }} onClick={() => onViewDiscussion(rep.id)}>View all discussion</button>
        </div>

        <button className="mw-stewardship-cta" onClick={() => onViewStewardship(rep.id)}>
          <CheckCircle2 size={16} />
          <span>View My Stewardship — what this rep says they've delivered</span>
          <ChevronRight size={16} />
        </button>

        <div style={{ marginBottom: 20 }} />

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Demands filed against this rep ({repDemands.length})</div>
          {repDemands.length === 0 && <div className="mw-form-hint">No demands filed yet.</div>}
          {repDemands.slice(0, 6).map((d) => (
            <div key={d.id} className="mw-rep-demand-row">
              <div className="mw-rep-demand-top">
                <span className="mw-rep-demand-title">{d.title}</span>
                <Stamp text={d.status} tone={DEMAND_STATUS_STAMP[d.status]} size="stamp-sm" />
              </div>
              {isActingAsRep && d.status !== "delivered" && (
                <div className="mw-chips" style={{ marginTop: 6 }}>
                  {d.status === "open" && (
                    <button className="mw-chip" onClick={() => onAcknowledgeDemand(d.id, "acknowledged")}>Acknowledge</button>
                  )}
                  <button className="mw-chip" onClick={() => onAcknowledgeDemand(d.id, "delivered")}>Mark Delivered</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Discussion about this rep ({repThreads.length})</div>
          {repThreads.length === 0 && <div className="mw-form-hint">No discussion threads yet.</div>}
          {repThreads.slice(0, 4).map((t) => (
            <button key={t.id} className="mw-rep-thread-row" onClick={() => onViewDiscussion(rep.id)}>
              <span className="mw-rep-demand-title">{t.title}</span>
              <span className="mw-form-hint" style={{ margin: 0 }}>
                {commentsList.filter((c) => c.threadId === t.id).length} replies
                {commentsList.some((c) => c.threadId === t.id && c.isOfficial) ? " · has official response" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AspirantCard({ aspirant, votedId, onVote }) {
  const initials = aspirant.name.replace(/^(Sen\.|Rep\.|Gov\.|Hon\.)\s/, "").split(" ").map(w => w[0]).join("").slice(0, 2);
  const hasVoted = votedId !== undefined;
  return (
    <div className="mw-aspirant-card">
      <div className="mw-card-top">
        <PhotoPlaceholder initials={initials} />
        <Stamp text={aspirant.isIncumbent ? "INCUMBENT" : "INEC CERTIFIED"} tone={aspirant.isIncumbent ? "stamp-verdant" : "stamp-brass"} size="stamp-sm" />
      </div>
      <h3 className="mw-card-name">{aspirant.name}</h3>
      <div className="mw-card-meta"><span>{aspirant.party}</span><span className="mw-dot">·</span><span>{aspirant.race} Aspirant</span></div>
      {aspirant.bio && <p className="mw-manifesto mw-bio">{aspirant.bio}</p>}
      <p className="mw-manifesto"><span className="mw-manifesto-label">Manifesto:</span> {aspirant.manifesto}</p>
      <div className="mw-card-footer mw-cert-date">
        {aspirant.isIncumbent ? "Seeking re-election" : `Certified ${aspirant.certifiedDate}`}
      </div>
      <button
        className={`mw-btn mw-btn-vote ${votedId === aspirant.id ? "mw-btn-voted" : ""}`}
        onClick={() => onVote(aspirant)}
        disabled={hasVoted}
      >
        <CheckCircle2 size={14} />
        {votedId === aspirant.id ? "Your pulse recorded" : hasVoted ? "Pulse closed" : "I Prefer"}
      </button>
    </div>
  );
}

function DemandCard({ demand, rep, upvoted, onUpvote }) {
  return (
    <div className="mw-demand-card">
      <button className={`mw-upvote ${upvoted ? "mw-upvote-active" : ""}`} onClick={() => onUpvote(demand.id)} disabled={upvoted}>
        <ThumbsUp size={15} />
        <span>{demand.upvotes}</span>
        <span className="mw-upvote-caption">{upvoted ? "Voted" : "Vote"}</span>
      </button>
      <div className="mw-demand-body">
        <div className="mw-demand-top">
          <h4 className="mw-demand-title">{demand.title}</h4>
          <Stamp text={demand.status} tone={DEMAND_STATUS_STAMP[demand.status]} size="stamp-sm" />
        </div>
        <p className="mw-demand-desc">{demand.description}</p>
        {demand.attachmentNames && demand.attachmentNames.length > 0 && (
          <div className="mw-attachment-row">
            <Paperclip size={11} />
            {demand.attachmentNames.length} file{demand.attachmentNames.length > 1 ? "s" : ""} attached
          </div>
        )}
        <div className="mw-demand-footer">
          <span>{rep ? rep.name : "Unlinked"}</span>
          <span className="mw-dot">·</span>
          <span>{rep ? `${rep.lga} LGA, ${rep.state} State` : ""}</span>
          <span className="mw-dot">·</span>
          <span>Filed by {demand.submittedBy}{demand.submittedByLga ? ` · ${demand.submittedByLga} LGA` : ""}</span>
        </div>
      </div>
    </div>
  );
}

// Demand filing is scoped to local/constituency representation — President, LG Chairman, and
// Councilor are excluded here (President has no single constituency; LG-level is Phase 2, per the PRD).
const DEMAND_CHAMBERS = [
  { value: "Governor", label: "Governor" },
  { value: "Senate", label: "Senator" },
  { value: "House of Reps", label: "Representative (House of Reps)" },
  { value: "State Assembly", label: "State Representative (State Assembly)" },
];

function repsForStateChamber(state, chamber) {
  return REPS.filter((r) => r.state === state && (!chamber || r.chamber === chamber));
}

function VoteButtons({ score, myVote, onVote, size = 13 }) {
  return (
    <div className="mw-vote-col">
      <button className={`mw-vote-arrow ${myVote === "up" ? "mw-vote-up-active" : ""}`} onClick={() => onVote("up")} disabled={!!myVote}>
        <ThumbsUp size={size} />
      </button>
      <span className="mw-vote-score">{score}</span>
      <button className={`mw-vote-arrow ${myVote === "down" ? "mw-vote-down-active" : ""}`} onClick={() => onVote("down")} disabled={!!myVote}>
        <ThumbsDown size={size} />
      </button>
    </div>
  );
}

function ThreadCard({ thread, rep, replyCount, myVote, onVote, onOpen }) {
  return (
    <div className="mw-thread-card">
      <VoteButtons score={thread.score} myVote={myVote} onVote={(dir) => onVote(thread.id, dir)} />
      <button className="mw-thread-body" onClick={() => onOpen(thread.id)}>
        <div className="mw-thread-tag">{rep ? rep.name : thread.issueTag}</div>
        <h4 className="mw-demand-title">{thread.title}</h4>
        <p className="mw-demand-desc">{thread.body}</p>
        <div className="mw-demand-footer">
          <span>Posted by {thread.author}</span>
          <span className="mw-dot">·</span>
          <span><MessageSquare size={11} style={{ verticalAlign: "-2px" }} /> {replyCount} replies</span>
        </div>
      </button>
    </div>
  );
}

function CommentRow({ comment, myVote, onVote, onReply, replies, commentVotes, onVoteReply }) {
  return (
    <div className="mw-comment">
      <div className={`mw-comment-row ${comment.isOfficial ? "mw-comment-row-official" : ""}`}>
        <VoteButtons score={comment.score} myVote={myVote} onVote={(dir) => onVote(comment.id, dir)} size={11} />
        <div>
          <div className="mw-comment-meta">
            {comment.author} · {comment.createdAt}
            {comment.isOfficial && <span className="mw-official-badge"><CheckCircle2 size={9} /> Official Response</span>}
          </div>
          <p className="mw-comment-body">{comment.body}</p>
          <button className="mw-link-btn" onClick={() => onReply(comment.id)}>Reply</button>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mw-comment-replies">
          {replies.map((r) => (
            <div className={`mw-comment-row ${r.isOfficial ? "mw-comment-row-official" : ""}`} key={r.id}>
              <CornerDownRight size={12} color="var(--ink-soft)" style={{ marginTop: 6, flexShrink: 0 }} />
              <VoteButtons score={r.score} myVote={commentVotes[r.id]} onVote={(dir) => onVoteReply(r.id, dir)} size={11} />
              <div>
                <div className="mw-comment-meta">
                  {r.author} · {r.createdAt}
                  {r.isOfficial && <span className="mw-official-badge"><CheckCircle2 size={9} /> Official Response</span>}
                </div>
                <p className="mw-comment-body">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadDetail({ thread, rep, comments, threadVote, commentVotes, onVoteThread, onVoteComment, onAddComment, onClose, user, isVerifiedForThisRep }) {
  const [replyBody, setReplyBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  if (!thread) return null;
  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesFor = (id) => comments.filter((c) => c.parentId === id);

  function submitReply() {
    if (!replyBody.trim()) return;
    onAddComment({ threadId: thread.id, parentId: replyTo, body: replyBody.trim(), isOfficial: isVerifiedForThisRep });
    setReplyBody("");
    setReplyTo(null);
  }

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mw-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="mw-thread-tag">{rep ? rep.name : thread.issueTag}</div>
        <h2 className="mw-modal-name" style={{ margin: "6px 0 10px" }}>{thread.title}</h2>
        <div className="mw-comment-row" style={{ marginBottom: 18 }}>
          <VoteButtons score={thread.score} myVote={threadVote} onVote={(dir) => onVoteThread(thread.id, dir)} />
          <div>
            <div className="mw-comment-meta">Posted by {thread.author} · {thread.createdAt}</div>
            <p className="mw-demand-desc" style={{ margin: "6px 0 0" }}>{thread.body}</p>
          </div>
        </div>

        <div className="mw-section-eyebrow">{comments.length} {comments.length === 1 ? "reply" : "replies"}</div>
        <div className="mw-comment-list">
          {topLevel.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              myVote={commentVotes[c.id]}
              onVote={(id, dir) => onVoteComment(id, dir)}
              onReply={(id) => setReplyTo(id)}
              replies={repliesFor(c.id)}
              commentVotes={commentVotes}
              onVoteReply={(id, dir) => onVoteComment(id, dir)}
            />
          ))}
          {topLevel.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", padding: "8px 0" }}>No replies yet — be the first to weigh in.</div>
          )}
        </div>

        <div className="mw-reply-box">
          {replyTo && (
            <div className="mw-form-hint" style={{ marginBottom: 6 }}>
              Replying to a comment. <button className="mw-link-btn" onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          )}
          {isVerifiedForThisRep && (
            <div className="mw-form-hint" style={{ marginBottom: 6, color: "var(--brass)" }}>
              <CheckCircle2 size={11} style={{ verticalAlign: "-1px" }} /> Posting as an Official Response from {rep ? rep.name : "this rep"}.
            </div>
          )}
          <textarea
            className="mw-form-input mw-form-textarea"
            placeholder={isVerifiedForThisRep ? "Write an official response…" : user ? "Add your reply…" : "Add your reply… (posting as Guest — sign up to use your name)"}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className="mw-modal-actions">
            <button className="mw-btn mw-btn-primary" onClick={submitReply} disabled={!replyBody.trim()}>
              {isVerifiedForThisRep ? "Post official response" : "Post reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewThreadModal({ open, onClose, onSubmit }) {
  const [mode, setMode] = useState("rep");
  const [repId, setRepId] = useState("");
  const [issueTag, setIssueTag] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) { setMode("rep"); setRepId(""); setIssueTag(""); setTitle(""); setBody(""); }
  }, [open]);

  if (!open) return null;

  function submit() {
    if (!title.trim() || !body.trim()) return;
    if (mode === "rep" && !repId) return;
    if (mode === "issue" && !issueTag.trim()) return;
    onSubmit({
      repId: mode === "rep" ? Number(repId) : null,
      issueTag: mode === "issue" ? issueTag.trim() : null,
      title: title.trim(),
      body: body.trim(),
    });
  }

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mw-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="mw-section-eyebrow">Start a discussion</div>
        <h2 className="mw-modal-name" style={{ marginBottom: 16 }}>What do you want to talk about?</h2>

        <div className="mw-chips" style={{ marginBottom: 4 }}>
          <button className={`mw-chip ${mode === "rep" ? "active" : ""}`} onClick={() => setMode("rep")}>About a rep</button>
          <button className={`mw-chip ${mode === "issue" ? "active" : ""}`} onClick={() => setMode("issue")}>About an issue</button>
        </div>

        {mode === "rep" ? (
          <>
            <label className="mw-form-label">Representative</label>
            <select className="mw-select mw-form-full" value={repId} onChange={(e) => setRepId(e.target.value)}>
              <option value="">Select a representative…</option>
              {REPS.filter((r) => PHASE1_CHAMBERS.includes(r.chamber)).map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.constituency}, {r.state}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className="mw-form-label">Issue tag</label>
            <input className="mw-form-input" placeholder="e.g. Fuel Subsidy, Insecurity, Education" value={issueTag} onChange={(e) => setIssueTag(e.target.value)} />
          </>
        )}

        <label className="mw-form-label">Title</label>
        <input className="mw-form-input" placeholder="What's the discussion about?" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="mw-form-label">Details</label>
        <textarea className="mw-form-input mw-form-textarea" placeholder="Add context for others to respond to…" value={body} onChange={(e) => setBody(e.target.value)} />

        <div className="mw-modal-actions">
          <button className="mw-btn mw-btn-primary" onClick={submit} disabled={!title.trim() || !body.trim()}>Post discussion</button>
          <button className="mw-btn mw-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage({ onGoHome }) {
  return (
    <div className="mw-page">
      <div className="mw-page-card" style={{ textAlign: "center" }}>
        <div className="mw-section-eyebrow">404</div>
        <h2 className="mw-modal-name">Page not found</h2>
        <p className="mw-form-hint" style={{ marginBottom: 18 }}>
          That page doesn't exist — it may have been moved, or the link might be out of date.
        </p>
        <button className="mw-btn mw-btn-primary" style={{ display: "inline-flex", maxWidth: 220, margin: "0 auto" }} onClick={onGoHome}>
          Back to Representatives
        </button>
      </div>
    </div>
  );
}

function UserProfilePage({ user, onBack, onSignOut, myDemands, myComments, myVotedReps, repById }) {
  if (!user) return null;
  return (
    <div className="mw-page">
      <button className="mw-back-btn" onClick={onBack}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back</button>

      <div className="mw-page-card">
        <div className="mw-section-eyebrow">Your Profile</div>
        <div className="mw-modal-header">
          <PhotoPlaceholder initials={user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()} size="mw-photo-lg" />
          <div>
            <h2 className="mw-modal-name">{user.name}</h2>
            <div className="mw-card-meta mw-card-meta-sub">
              <MapPin size={11} /><span>{user.lga} LGA, {user.state}</span>
            </div>
            <div className="mw-card-meta mw-card-meta-sub">
              <span>{user.email}</span><span className="mw-dot">·</span><span>{user.phone}</span>
            </div>
          </div>
        </div>

        <div className="mw-file-stats" style={{ margin: "18px 0" }}>
          <div><span className="mw-file-num">{myDemands.length}</span><span className="mw-file-label">demands filed</span></div>
          <div><span className="mw-file-num">{myComments.length}</span><span className="mw-file-label">comments posted</span></div>
          <div><span className="mw-file-num">{myVotedReps.length}</span><span className="mw-file-label">reps rated</span></div>
        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Demands you've filed</div>
          {myDemands.length === 0 && <div className="mw-form-hint">You haven't filed any demands yet.</div>}
          {myDemands.map((d) => (
            <div key={d.id} className="mw-rep-demand-row">
              <div className="mw-rep-demand-top">
                <span className="mw-rep-demand-title">{d.title}</span>
                <Stamp text={d.status} tone={DEMAND_STATUS_STAMP[d.status]} size="stamp-sm" />
              </div>
            </div>
          ))}
        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Comments you've posted</div>
          {myComments.length === 0 && <div className="mw-form-hint">You haven't posted any comments yet.</div>}
          {myComments.map((c) => (
            <div key={c.id} className="mw-rep-demand-row">
              <p className="mw-comment-body" style={{ margin: 0 }}>{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mw-modal-section">
          <div className="mw-section-eyebrow">Reps you've rated</div>
          {myVotedReps.length === 0 && <div className="mw-form-hint">You haven't rated any reps yet.</div>}
          {myVotedReps.map(({ repId, votes }) => {
            const rep = repById[repId];
            if (!rep) return null;
            return (
              <div key={repId} className="mw-rep-demand-row">
                <span className="mw-rep-demand-title">{rep.name}</span>
                <span className="mw-form-hint" style={{ margin: "2px 0 0" }}>
                  {votes.approval && `Approval: ${votes.approval === "up" ? "Approved" : "Disapproved"}`}
                  {votes.approval && votes.presence ? " · " : ""}
                  {votes.presence && `Projects: ${votes.presence === "up" ? "Yes, delivered" : "No, nothing seen"}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mw-modal-actions">
          <button className="mw-btn mw-btn-ghost" style={{ flex: 1 }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

const BLANK_REP_FORM = {
  name: "", chamber: "Senate", state: "Abia", constituency: "", lga: "", town: "", party: "APC",
  electedYear: "2023", termStart: "2023", termEnd: "2027", termNumber: "1st Term", role: "", photoUrl: "",
};

function RepForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function handlePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photoUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!form.name.trim() || !form.constituency.trim()) return;
    onSubmit({
      ...form,
      electedYear: Number(form.electedYear) || 2023,
      termStart: Number(form.termStart) || 2023,
      termEnd: Number(form.termEnd) || 2027,
    });
  }

  return (
    <div className="mw-admin-form">
      <label className="mw-form-label">Photo</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PhotoPlaceholder initials={(form.name || "??").split(" ").map((w) => w[0]).join("").slice(0, 2)} photoUrl={form.photoUrl} size="mw-photo-lg" />
        <label className="mw-file-drop" style={{ flex: 1 }}>
          <Paperclip size={14} />
          <span>{form.photoUrl ? "Change photo" : "Upload a photo"}</span>
          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </label>
      </div>

      <label className="mw-form-label">Full name (with title, e.g. "Sen." / "Hon." / "Gov.")</label>
      <input className="mw-form-input" value={form.name} onChange={set("name")} placeholder="e.g. Sen. Jane Doe" />

      <div className="mw-admin-grid-2">
        <div>
          <label className="mw-form-label">Type of representative</label>
          <select className="mw-select mw-form-full" value={form.chamber} onChange={set("chamber")}>
            <option value="President">President</option>
            <option value="Governor">Governor</option>
            <option value="Senate">Senator</option>
            <option value="House of Reps">Member, House of Representatives</option>
            <option value="State Assembly">Member, State House of Assembly</option>
            <option value="LG Chairman">LG Chairman</option>
            <option value="Councilor">Councilor</option>
          </select>
        </div>
        <div>
          <label className="mw-form-label">State</label>
          <select className="mw-select mw-form-full" value={form.state} onChange={set("state")}>
            {Object.entries(REGIONS).map(([region, states]) => (
              <optgroup key={region} label={region}>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <label className="mw-form-label">Constituency / district (the official name, e.g. "Abia North", "Ikeja")</label>
      <input className="mw-form-input" value={form.constituency} onChange={set("constituency")} placeholder="e.g. Abia North" />

      <div className="mw-admin-grid-2">
        <div>
          <label className="mw-form-label">LGA</label>
          <input className="mw-form-input" value={form.lga} onChange={set("lga")} placeholder="e.g. Umuahia North" list="admin-lga-list" />
          <datalist id="admin-lga-list">
            {(LGAS_BY_STATE[form.state] || []).map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label className="mw-form-label">Town</label>
          <input className="mw-form-input" value={form.town} onChange={set("town")} />
        </div>
      </div>

      <div className="mw-admin-grid-2">
        <div>
          <label className="mw-form-label">Party</label>
          <select className="mw-select mw-form-full" value={form.party} onChange={set("party")}>
            {Object.keys(PARTY_COLORS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="mw-form-label">Leadership role (optional, e.g. "Speaker")</label>
          <input className="mw-form-input" value={form.role} onChange={set("role")} />
        </div>
      </div>

      <div className="mw-admin-grid-3">
        <div>
          <label className="mw-form-label">Elected year</label>
          <input className="mw-form-input" type="number" value={form.electedYear} onChange={set("electedYear")} />
        </div>
        <div>
          <label className="mw-form-label">Term start</label>
          <input className="mw-form-input" type="number" value={form.termStart} onChange={set("termStart")} />
        </div>
        <div>
          <label className="mw-form-label">Term end</label>
          <input className="mw-form-input" type="number" value={form.termEnd} onChange={set("termEnd")} />
        </div>
      </div>

      <label className="mw-form-label">Term number (e.g. "1st Term")</label>
      <input className="mw-form-input" value={form.termNumber} onChange={set("termNumber")} />

      <div className="mw-modal-actions">
        <button className="mw-btn mw-btn-primary" onClick={submit}>{submitLabel}</button>
        {onCancel && <button className="mw-btn mw-btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function AdminPanel({ repsData, onAddRep, onUpdateRep, onAddAspirant, demandsList, threadsList, aspirantsList, commentsList, pendingClaims, onApproveClaim, onRejectClaim, electionModeEnabled, onToggleElectionMode }) {
  const [section, setSection] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [aspirantForm, setAspirantForm] = useState({ name: "", party: "APC", state: "Lagos", race: "", bio: "", manifesto: "", isIncumbent: false, certifiedDate: "" });

  const editingRep = editingId ? repsData.find((r) => r.id === editingId) : null;

  function exportData() {
    const payload = { representatives: repsData, demands: demandsList, threads: threadsList, comments: commentsList, aspirants: aspirantsList };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mandatewatch-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function submitAspirant() {
    if (!aspirantForm.name.trim() || !aspirantForm.race.trim()) return;
    const newId = Date.now();
    onAddAspirant({ id: newId, ...aspirantForm, favorability: 0 });
    setAspirantForm({ name: "", party: "APC", state: "Lagos", race: "", bio: "", manifesto: "", isIncumbent: false, certifiedDate: "" });
  }

  const filteredReps = repsData.filter((r) => {
    const q = searchQ.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.state.toLowerCase().includes(q) || r.constituency.toLowerCase().includes(q);
  });

  return (
    <div className="mw-page">
      <div className="mw-section-eyebrow">Admin — no-code data entry</div>
      <h2 className="mw-modal-name" style={{ marginBottom: 4 }}>Manage MandateWatch Data</h2>
      <div className="mw-form-hint" style={{ marginBottom: 16 }}>
        Prototype demo — access is gated to allowlisted admin accounts, but changes made here still only apply to this browser session, not the live database.
      </div>

      <div className="mw-rep-demand-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div className="mw-rep-demand-title">Election Mode</div>
          <div className="mw-form-hint" style={{ margin: 0 }}>
            {electionModeEnabled ? "On — the Election Watch tab is visible to everyone." : "Off — Election Watch is hidden site-wide until an election period."}
          </div>
        </div>
        <button className={`mw-chip ${electionModeEnabled ? "active" : ""}`} onClick={onToggleElectionMode}>
          {electionModeEnabled ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="mw-admin-tabs">
        <button className={`mw-chip ${section === "add" ? "active" : ""}`} onClick={() => { setSection("add"); setEditingId(null); }}>Add a Rep</button>
        <button className={`mw-chip ${section === "manage" ? "active" : ""}`} onClick={() => setSection("manage")}>Manage Reps ({repsData.length})</button>
        <button className={`mw-chip ${section === "aspirant" ? "active" : ""}`} onClick={() => setSection("aspirant")}>Add an Aspirant</button>
        <button className={`mw-chip ${section === "claims" ? "active" : ""}`} onClick={() => setSection("claims")}>Rep Claims ({pendingClaims.length})</button>
        <button className={`mw-chip ${section === "export" ? "active" : ""}`} onClick={() => setSection("export")}>Export Data</button>
      </div>

      <div className="mw-page-card">
        {section === "claims" && (
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {pendingClaims.map((c) => {
              const rep = repsData.find((r) => r.id === c.repId);
              return (
                <div key={c.id} className="mw-rep-demand-row">
                  <div className="mw-rep-demand-top">
                    <span className="mw-rep-demand-title">{c.requesterName} ({c.requesterEmail}) wants to claim {rep ? rep.name : `rep #${c.repId}`}</span>
                    <span className="mw-form-hint" style={{ margin: 0 }}>{c.createdAt}</span>
                  </div>
                  <p className="mw-comment-body" style={{ margin: "6px 0" }}>{c.justification}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="mw-chip" onClick={() => onApproveClaim(c.id)}>Approve</button>
                    <button className="mw-chip" onClick={() => onRejectClaim(c.id)}>Reject</button>
                  </div>
                </div>
              );
            })}
            {pendingClaims.length === 0 && <div className="mw-form-hint">No pending claim requests.</div>}
          </div>
        )}

        {section === "add" && !editingId && (
          <RepForm
            initial={BLANK_REP_FORM}
            submitLabel="Add representative"
            onSubmit={(data) => { onAddRep(data); }}
          />
        )}

        {section === "manage" && !editingId && (
          <>
            <div className="mw-search" style={{ marginBottom: 14 }}>
              <Search size={15} color="#97998a" />
              <input placeholder="Search by name, state, or constituency…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {filteredReps.map((r) => (
                <div key={r.id} className="mw-rep-demand-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="mw-rep-demand-title">{r.name}</div>
                    <div className="mw-form-hint" style={{ margin: 0 }}>{r.chamber} · {r.state} · {r.constituency} · {r.party}</div>
                  </div>
                  <button className="mw-chip" onClick={() => setEditingId(r.id)}>Edit</button>
                </div>
              ))}
              {filteredReps.length === 0 && <div className="mw-form-hint">No reps match that search.</div>}
            </div>
          </>
        )}

        {editingId && editingRep && (
          <RepForm
            initial={{ ...editingRep, electedYear: String(editingRep.electedYear), termStart: String(editingRep.termStart), termEnd: String(editingRep.termEnd), role: editingRep.role || "", photoUrl: editingRep.photoUrl || "" }}
            submitLabel="Save changes"
            onCancel={() => setEditingId(null)}
            onSubmit={(data) => { onUpdateRep(editingId, data); setEditingId(null); setSection("manage"); }}
          />
        )}

        {section === "aspirant" && (
          <div className="mw-admin-form">
            <label className="mw-form-label">Aspirant name</label>
            <input className="mw-form-input" value={aspirantForm.name} onChange={(e) => setAspirantForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="mw-admin-grid-2">
              <div>
                <label className="mw-form-label">Party</label>
                <select className="mw-select mw-form-full" value={aspirantForm.party} onChange={(e) => setAspirantForm((f) => ({ ...f, party: e.target.value }))}>
                  {Object.keys(PARTY_COLORS).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mw-form-label">State</label>
                <select className="mw-select mw-form-full" value={aspirantForm.state} onChange={(e) => setAspirantForm((f) => ({ ...f, state: e.target.value }))}>
                  {Object.entries(REGIONS).map(([region, states]) => (
                    <optgroup key={region} label={region}>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <label className="mw-form-label">Race (e.g. "Ogun State Governorship")</label>
            <input className="mw-form-input" value={aspirantForm.race} onChange={(e) => setAspirantForm((f) => ({ ...f, race: e.target.value }))} />
            <label className="mw-form-label">Bio</label>
            <textarea className="mw-form-input mw-form-textarea" value={aspirantForm.bio} onChange={(e) => setAspirantForm((f) => ({ ...f, bio: e.target.value }))} />
            <label className="mw-form-label">Manifesto</label>
            <textarea className="mw-form-input mw-form-textarea" value={aspirantForm.manifesto} onChange={(e) => setAspirantForm((f) => ({ ...f, manifesto: e.target.value }))} />
            <label className="mw-form-label">INEC certified date</label>
            <input className="mw-form-input" value={aspirantForm.certifiedDate} onChange={(e) => setAspirantForm((f) => ({ ...f, certifiedDate: e.target.value }))} placeholder="e.g. 12 May 2027" />
            <label className="mw-form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={aspirantForm.isIncumbent} onChange={(e) => setAspirantForm((f) => ({ ...f, isIncumbent: e.target.checked }))} />
              This person is the incumbent seeking re-election
            </label>
            <div className="mw-modal-actions">
              <button className="mw-btn mw-btn-primary" onClick={submitAspirant}>Add aspirant</button>
            </div>
          </div>
        )}

        {section === "export" && (
          <div>
            <p className="mw-demand-desc">
              Download everything currently in the app — representatives, demands, discussions, and aspirants — as a JSON file.
              Useful as a backup, or to hand off to a developer when this moves to a real database.
            </p>
            <div className="mw-file-stats" style={{ marginBottom: 16 }}>
              <div><span className="mw-file-num">{repsData.length}</span><span className="mw-file-label">representatives</span></div>
              <div><span className="mw-file-num">{demandsList.length}</span><span className="mw-file-label">demands</span></div>
              <div><span className="mw-file-num">{threadsList.length}</span><span className="mw-file-label">threads</span></div>
            </div>
            <button className="mw-btn mw-btn-primary" onClick={exportData}>Download JSON export</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StewardshipPage({ rep, entries, isActingAsRep, verifiedIds, onAdd, onVerify, onBack }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!rep) return null;
  const initials = rep.name.replace(/^(Sen\.|Rep\.|Gov\.|Hon\.)\s/, "").split(" ").map(w => w[0]).join("").slice(0, 2);
  const info = CHAMBER_INFO[rep.chamber];

  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), description: description.trim() });
    setTitle("");
    setDescription("");
  }

  return (
    <div className="mw-page">
      <button className="mw-back-btn" onClick={onBack}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to profile</button>

      <div className="mw-page-card">
        <div className="mw-section-eyebrow">My Stewardship</div>
        <div className="mw-modal-header">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <PhotoPlaceholder initials={initials} size="mw-photo-lg" photoUrl={rep.photoUrl} />
            <div className="mw-party-col">
              <PartyBadge party={rep.party} size="mw-party-badge-lg" />
              <span className="mw-party-name">{rep.party}</span>
            </div>
          </div>
          <div>
            <h2 className="mw-modal-name">{rep.name}</h2>
            {info && <div className="mw-rep-full-title">{repTitleLabel(rep, info)}</div>}
          </div>
        </div>

        <div className="mw-form-hint" style={{ margin: "4px 0 18px" }}>
          A record of what this rep says they've delivered — each entry stays unverified until citizens confirm it happened. The claim gate above is real and admin-reviewed; this board itself is still prototype-only and resets on refresh.
        </div>

        {isActingAsRep && (
          <div className="mw-admin-form" style={{ marginBottom: 20, paddingBottom: 18, borderBottom: "1px dashed var(--line)" }}>
            <label className="mw-form-label">What did you deliver?</label>
            <input className="mw-form-input" placeholder="e.g. Rehabilitated the Central Market access road" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="mw-form-label">Details (optional)</label>
            <textarea className="mw-form-input mw-form-textarea" placeholder="Where, when, who it affects…" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="mw-modal-actions">
              <button className="mw-btn mw-btn-primary" onClick={submit}>Post to stewardship record</button>
            </div>
          </div>
        )}

        {entries.length === 0 && <div className="mw-form-hint">No stewardship entries posted yet.</div>}
        <div className="mw-comment-list">
          {entries.map((entry) => {
            const isVerified = verifiedIds.includes(entry.id);
            return (
              <div key={entry.id} className="mw-stewardship-entry">
                <div className="mw-stewardship-top">
                  <div>
                    <div className="mw-rep-demand-title">{entry.title}</div>
                    <div className="mw-form-hint" style={{ margin: "2px 0 0" }}>{entry.date}</div>
                  </div>
                </div>
                {entry.description && <p className="mw-comment-body" style={{ margin: "8px 0" }}>{entry.description}</p>}
                <div className="mw-stewardship-footer">
                  <button
                    className={`mw-verify-btn ${isVerified ? "mw-verify-btn-active" : ""}`}
                    onClick={() => onVerify(entry.id)}
                    disabled={isVerified}
                  >
                    <CheckCircle2 size={14} />
                    {isVerified ? "You verified this" : "Verify this happened"}
                  </button>
                  {entry.verifiedCount > 0 && (
                    <span className="mw-verify-stamp">
                      <CheckCircle2 size={12} /> VERIFIED BY {entry.verifiedCount} CITIZEN{entry.verifiedCount === 1 ? "" : "S"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AuthModal({ open, onClose, onComplete, pendingAuthUser }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null); // { id, email } once a session exists

  useEffect(() => {
    if (!open) return;
    setName(""); setPhone(""); setState(""); setLga(""); setError(""); setBusy(false);
    if (pendingAuthUser) {
      // Arrived here because a magic-link click already produced a session with no profile
      // row yet — skip straight to collecting the signup details, no email step needed.
      setVerifiedUser(pendingAuthUser);
      setEmail(pendingAuthUser.email);
      setStep("details");
    } else {
      setEmail(""); setVerifiedUser(null); setStep("email");
    }
  }, [open, pendingAuthUser]);

  if (!open) return null;

  async function sendLink() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address"); return; }
    setError("");
    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (sendError) { setError(sendError.message); return; }
      setStep("sent");
    } catch (thrown) {
      setBusy(false);
      setError(thrown?.message || String(thrown));
    }
  }

  async function finish() {
    if (!name.trim() || !phone.trim() || !state || !lga.trim()) {
      setError("Add your name, phone number, state, and LGA to finish signing up");
      return;
    }
    if (!/^0\d{10}$/.test(phone.trim())) { setError("Enter a valid 11-digit Nigerian number, e.g. 08012345678"); return; }
    setError("");
    setBusy(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: verifiedUser.id, name: name.trim(), phone: phone.trim(), state_code: state, lga: lga.trim(),
    });
    setBusy(false);
    if (insertError) { setError(insertError.message); return; }
    onComplete({ id: verifiedUser.id, email: verifiedUser.email, name: name.trim(), phone: phone.trim(), state, lga: lga.trim() });
  }

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <button className="mw-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="mw-section-eyebrow">Sign up to vote &amp; file demands</div>
        <h2 className="mw-modal-name" style={{ marginBottom: 16 }}>
          {step === "email" && "Sign up or sign in"}
          {step === "sent" && "Check your email"}
          {step === "details" && "Almost done"}
        </h2>

        {step === "email" && (
          <>
            <label className="mw-form-label">Email address</label>
            <input className="mw-form-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="mw-form-hint">We'll email you a link — click it to sign in, no password needed.</div>
            {error && <div className="mw-form-error">{error}</div>}
            <div className="mw-modal-actions">
              <button className="mw-btn mw-btn-primary" onClick={sendLink} disabled={busy}>{busy ? "Sending…" : "Send sign-in link"}</button>
            </div>
          </>
        )}

        {step === "sent" && (
          <>
            <p className="mw-pulse-question" style={{ marginTop: 0 }}>
              We sent a sign-in link to <b>{email}</b>. Open that email and click the link to
              continue — you can close this window, it'll pick up automatically once you're back.
            </p>
            <div className="mw-modal-actions">
              <button className="mw-btn mw-btn-ghost" onClick={() => setStep("email")} disabled={busy}>Use a different email</button>
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <div className="mw-form-hint" style={{ marginBottom: 10 }}>Verified as <b>{email}</b>.</div>
            <label className="mw-form-label">Full name or initials</label>
            <input className="mw-form-input" placeholder="e.g. Muyiwa Adeyemi or M.A." value={name} onChange={(e) => setName(e.target.value)} />
            <div className="mw-form-hint">Shown publicly on demands you file — use initials if you'd rather not share your full name.</div>

            <label className="mw-form-label">Phone number</label>
            <input className="mw-form-input" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} />

            <label className="mw-form-label">Your state</label>
            <select className="mw-select mw-form-full" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Select your state…</option>
              {Object.entries(REGIONS).map(([region, states]) => (
                <optgroup key={region} label={region}>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>

            <label className="mw-form-label">Local Government Area (LGA)</label>
            {LGAS_BY_STATE[state] ? (
              <select className="mw-select mw-form-full" value={lga} onChange={(e) => setLga(e.target.value)}>
                <option value="">Select your LGA…</option>
                {LGAS_BY_STATE[state].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            ) : (
              <>
                <input className="mw-form-input" placeholder="e.g. Ikeja" value={lga} onChange={(e) => setLga(e.target.value)} />
                {state && <div className="mw-form-hint" style={{ color: "var(--brass)" }}>Full LGA list for {state} isn't compiled yet — type it manually for now.</div>}
              </>
            )}
            <div className="mw-form-hint">Narrows demands and polls down to your area — shown on demands you file.</div>

            {error && <div className="mw-form-error">{error}</div>}
            <div className="mw-modal-actions">
              <button className="mw-btn mw-btn-primary" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish signing up"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClaimRepModal({ rep, onClose, onSubmit }) {
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (rep) { setJustification(""); setError(""); setBusy(false); }
  }, [rep]);

  if (!rep) return null;

  async function submit() {
    setBusy(true);
    setError("");
    const errorMessage = await onSubmit(justification.trim());
    setBusy(false);
    if (errorMessage) setError(errorMessage);
    else onClose();
  }

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mw-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="mw-section-eyebrow">Claim &amp; verify</div>
        <h2 className="mw-modal-name" style={{ marginBottom: 16 }}>Claim {rep.name}'s profile</h2>

        <label className="mw-form-label">How can we verify this is you?</label>
        <textarea
          className="mw-form-input mw-form-textarea"
          placeholder="Share an official email address, a verified social account, or another way to confirm your identity as this representative…"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
        <div className="mw-form-hint">Reviewed manually by MandateWatch — you'll be marked as a Verified Rep once approved.</div>
        {error && <div className="mw-form-error">{error}</div>}

        <div className="mw-modal-actions">
          <button className="mw-btn mw-btn-primary" onClick={submit} disabled={!justification.trim() || busy}>{busy ? "Submitting…" : "Submit claim"}</button>
          <button className="mw-btn mw-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SubmitDemandModal({ open, onClose, onSubmit, prefillRepId, user }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repId, setRepId] = useState("");
  const [selState, setSelState] = useState("");
  const [selChamber, setSelChamber] = useState("");
  const [manualPick, setManualPick] = useState(false);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setFiles([]);
    if (prefillRepId) {
      const rep = REPS.find((r) => r.id === prefillRepId);
      setRepId(String(prefillRepId));
      setSelState(rep ? rep.state : "");
      setSelChamber(rep ? rep.chamber : "");
      setManualPick(false);
    } else {
      setRepId("");
      setSelState(user ? user.state : "");
      setSelChamber("");
      setManualPick(true);
    }
  }, [open, prefillRepId, user]);

  if (!open) return null;

  const prefillRep = prefillRepId ? REPS.find((r) => r.id === prefillRepId) : null;
  // Signed-in users can only file demands for reps in their own state — no override. Guests (no
  // known state) still get a free state picker since there's nothing to restrict them to.
  const stateLocked = !!user;
  const repOptions = repsForStateChamber(selState, selChamber);

  function handleFileChange(e) {
    const picked = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!title.trim() || !repId) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      repId: Number(repId),
      attachmentNames: files.map((f) => f.name),
    });
  }

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mw-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="mw-section-eyebrow">File a demand</div>
        <h2 className="mw-modal-name" style={{ marginBottom: 16 }}>What do you want your rep to act on?</h2>

        {prefillRep && !manualPick ? (
          <div className="mw-prefill-rep">
            <span>Filing for <b>{prefillRep.name}</b> — {prefillRep.chamber}, {prefillRep.state}</span>
            <button className="mw-link-btn" onClick={() => { setManualPick(true); setRepId(""); }}>Not the right rep? Choose another</button>
          </div>
        ) : (
          <>
            <label className="mw-form-label">Type of representative</label>
            <select
              className="mw-select mw-form-full"
              value={selChamber}
              onChange={(e) => { setSelChamber(e.target.value); setRepId(""); }}
            >
              <option value="">Select a type of representative…</option>
              {DEMAND_CHAMBERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <label className="mw-form-label">State</label>
            {stateLocked ? (
              <div className="mw-prefill-rep">
                <span>Filing for reps in <b>{user.state}</b> — you can only file demands for your own state</span>
              </div>
            ) : (
              <select
                className="mw-select mw-form-full"
                value={selState}
                onChange={(e) => { setSelState(e.target.value); setRepId(""); }}
              >
                <option value="">Select your state…</option>
                {Object.entries(REGIONS).map(([region, states]) => (
                  <optgroup key={region} label={region}>
                    {states.map((s) => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                ))}
              </select>
            )}

            <label className="mw-form-label">Representative</label>
            <select
              className="mw-select mw-form-full"
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              disabled={!selChamber || !selState}
            >
              <option value="">
                {!selChamber ? "Select a type first" : !selState ? "Select a state first" : repOptions.length ? "Select a representative…" : "No match in sample data yet"}
              </option>
              {repOptions.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.constituency}, {r.state}</option>)}
            </select>
          </>
        )}

        <label className="mw-form-label">Demand title</label>
        <input className="mw-form-input" placeholder="e.g. Fix the borehole at Central Market" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="mw-form-label">Details (optional)</label>
        <textarea className="mw-form-input mw-form-textarea" placeholder="Add context — where, how long it's been an issue, who's affected…" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="mw-form-label">Attach photos or documents (optional)</label>
        <label className="mw-file-drop">
          <Paperclip size={14} />
          <span>Add files — photos, PDFs, up to 5</span>
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} style={{ display: "none" }} />
        </label>
        {files.length > 0 && (
          <div className="mw-file-chip-list">
            {files.map((f, i) => (
              <span key={i} className="mw-file-chip">
                {f.name}
                <button type="button" onClick={() => removeFile(i)}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="mw-form-hint">Prototype demo — files are attached locally for this session only, not uploaded to a server.</div>

        <div className="mw-modal-actions">
          <button className="mw-btn mw-btn-primary" onClick={submit} disabled={!title.trim() || !repId}>File this demand</button>
          <button className="mw-btn mw-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MAIN APP
--------------------------------------------------------------- */

export default function MandateWatch() {
  const platform = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPath(location.pathname);
  const knownPath = isKnownPath(location.pathname);
  function setTab(key) { navigate(TAB_PATHS[key] ?? "/"); }
  const [electionModeEnabled, setElectionModeEnabled] = useState(false);
  const [query, setQuery] = useState("");
  const [chamberFilter, setChamberFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [repsData, setRepsData] = useState(REPS);
  const [repVotes, setRepVotes] = useState({});
  const openRepIdMatch = location.pathname.match(/^\/representatives\/(\d+)(?:\/|$)/);
  const openRepId = openRepIdMatch ? Number(openRepIdMatch[1]) : null;
  function setOpenRepId(id) { navigate(id ? `/representatives/${id}` : "/"); }
  const [aspirantVotes, setAspirantVotes] = useState({});
  const [voteCounts, setVoteCounts] = useState({});
  const [aspirantQuery, setAspirantQuery] = useState("");
  const [aspirantStateFilter, setAspirantStateFilter] = useState("All");

  const [demandsList, setDemandsList] = useState([]);
  const [aspirantsList, setAspirantsList] = useState(ASPIRANTS);
  const [demandQuery, setDemandQuery] = useState("");
  const [demandStateFilter, setDemandStateFilter] = useState("All");
  const [demandStatusFilter, setDemandStatusFilter] = useState("all");
  const [demandSort, setDemandSort] = useState("top");
  const [upvotedIds, setUpvotedIds] = useState([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPrefillRepId, setSubmitPrefillRepId] = useState(null);
  const { user, setUser, authUser, needsProfile, isAdmin, signOut } = useAuth();

  // Landed back here after clicking a magic-link email with no profile yet (first-time signup) —
  // jump straight to collecting name/phone/state/lga instead of requiring the user to click
  // "Sign up" again.
  useEffect(() => {
    if (needsProfile) setAuthOpen(true);
  }, [needsProfile]);
  const [authOpen, setAuthOpen] = useState(false);

  const [threadsList, setThreadsList] = useState([]);
  const [commentsList, setCommentsList] = useState([]);
  const [threadVotes, setThreadVotes] = useState({});
  const [commentVotes, setCommentVotes] = useState({});
  const [openThreadId, setOpenThreadId] = useState(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [activeRepView, setActiveRepView] = useState(null);
  const [myClaimStatus, setMyClaimStatus] = useState({}); // repId -> "pending" | "rejected", own requests only
  const [claimModalRepId, setClaimModalRepId] = useState(null);
  const [pendingClaims, setPendingClaims] = useState([]); // admin-only: all pending requests to review
  const userProfileOpen = location.pathname === "/me";
  function setUserProfileOpen(open) { navigate(open ? "/me" : "/"); }
  const [threadQuery, setThreadQuery] = useState("");
  const [threadRepFilter, setThreadRepFilter] = useState(null);

  async function handleVoteThread(threadId, dir) {
    if (!user) { setAuthOpen(true); return; }
    if (threadVotes[threadId]) return;

    // Optimistic local update first — the unique constraint on (thread_id, user_id) is the real
    // enforcement point; this is just responsive UI, corrected below if the insert fails.
    setThreadVotes((prev) => ({ ...prev, [threadId]: dir }));
    setThreadsList((list) => list.map((t) => (t.id === threadId ? { ...t, score: t.score + (dir === "up" ? 1 : -1) } : t)));

    const { error } = await supabase.from("thread_votes").insert({ thread_id: threadId, user_id: user.id, direction: dir });
    if (error) {
      // Most likely a duplicate vote from another tab/device — revert the optimistic update
      // rather than leave the UI showing a vote that wasn't actually recorded.
      setThreadVotes((prev) => { const next = { ...prev }; delete next[threadId]; return next; });
      setThreadsList((list) => list.map((t) => (t.id === threadId ? { ...t, score: t.score - (dir === "up" ? 1 : -1) } : t)));
    }
  }

  async function handleVoteComment(commentId, dir) {
    if (!user) { setAuthOpen(true); return; }
    if (commentVotes[commentId]) return;

    setCommentVotes((prev) => ({ ...prev, [commentId]: dir }));
    setCommentsList((list) => list.map((c) => (c.id === commentId ? { ...c, score: c.score + (dir === "up" ? 1 : -1) } : c)));

    const { error } = await supabase.from("comment_votes").insert({ comment_id: commentId, user_id: user.id, direction: dir });
    if (error) {
      setCommentVotes((prev) => { const next = { ...prev }; delete next[commentId]; return next; });
      setCommentsList((list) => list.map((c) => (c.id === commentId ? { ...c, score: c.score - (dir === "up" ? 1 : -1) } : c)));
    }
  }

  async function handleAddComment({ threadId, parentId, body }) {
    if (!user) { setAuthOpen(true); return; }

    // is_official is intentionally never sent here — real rep verification doesn't exist yet, and
    // the RLS insert policy on `comments` forces is_official = false regardless. Posting via the
    // demo "Claim & Verify This Profile" button no longer produces a badge that survives a reload.
    const { data, error } = await supabase
      .from("comments")
      .insert({ thread_id: threadId, parent_id: parentId, user_id: user.id, author_name: user.name, body })
      .select()
      .single();
    if (error || !data) return;

    setCommentsList((prev) => [
      ...prev,
      {
        id: data.id,
        threadId: data.thread_id,
        parentId: data.parent_id,
        userId: data.user_id,
        author: data.author_name,
        body: data.body,
        score: data.score, // starts at 1 — the seed_comment_self_vote() trigger already ran
        isOfficial: data.is_official,
        createdAt: data.created_at.slice(0, 10),
      },
    ]);
    setCommentVotes((prev) => ({ ...prev, [data.id]: "up" }));
  }

  async function handleStartThread({ title, body, repId, issueTag }) {
    if (!user) { setAuthOpen(true); return; }

    const { data, error } = await supabase
      .from("threads")
      .insert({
        rep_id: repId || null,
        issue_tag: repId ? null : issueTag,
        title,
        body,
        user_id: user.id,
        author_name: user.name,
      })
      .select()
      .single();
    if (error || !data) return;

    setThreadsList((prev) => [
      {
        id: data.id,
        repId: data.rep_id,
        issueTag: data.issue_tag,
        title: data.title,
        body: data.body,
        userId: data.user_id,
        author: data.author_name,
        score: data.score, // starts at 1 — the seed_thread_self_vote() trigger already ran
        createdAt: data.created_at.slice(0, 10),
      },
      ...prev,
    ]);
    setThreadVotes((prev) => ({ ...prev, [data.id]: "up" }));
  }

  const repById = useMemo(() => Object.fromEntries(repsData.map((r) => [r.id, r])), [repsData]);
  const phase1Reps = useMemo(() => repsData.filter((r) => PHASE1_CHAMBERS.includes(r.chamber)), [repsData]);
  const openRep = openRepId ? repById[openRepId] : null;
  const ownsRep = (repId) => !!user && repById[repId]?.claimedBy === user.id;

  // A bad/stale rep id in the URL is a real reachable case now that these are bookmarkable links
  // (it couldn't happen before, since ids only ever came from clicking a real rep card).
  useEffect(() => {
    if (openRepId && repsData.length > 0 && !openRep) navigate("/", { replace: true });
  }, [openRepId, openRep, repsData.length, navigate]);
  const localRepById = useMemo(() => Object.fromEntries(REPS.map((r) => [r.id, r])), []);

  // Live representatives + scores from Supabase, replacing the bundled REPS array on load.
  // demands/topDemand/status have no home in this slice's schema yet, so they're merged in
  // from the local REPS module until a later Demands slice replaces them with a real count.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("representatives")
      .select("*, rep_scores(*)")
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        const merged = data.map((row) => {
          const scores = row.rep_scores || {};
          const approvalTotal = (scores.approval_up ?? 0) + (scores.approval_down ?? 0);
          const presenceTotal = (scores.presence_up ?? 0) + (scores.presence_down ?? 0);
          const local = localRepById[row.id] || {};
          return {
            id: row.id,
            name: row.name,
            chamber: row.chamber,
            state: row.state_code,
            constituency: row.constituency,
            lga: row.lga,
            town: row.town,
            party: row.party_code,
            photoUrl: row.photo_url || undefined,
            role: row.role || undefined,
            electedYear: row.elected_year,
            termStart: row.term_start,
            termEnd: row.term_end,
            termNumber: row.term_number,
            approval: approvalTotal > 0 ? Math.round((scores.approval_up / approvalTotal) * 100) : 50,
            presence: presenceTotal > 0 ? Math.round((scores.presence_up / presenceTotal) * 100) : 50,
            demands: local.demands ?? 0,
            topDemand: local.topDemand ?? "No demands filed yet — be the first.",
            status: local.status ?? "ON WATCH",
            claimedBy: row.claimed_by,
          };
        });
        if (merged.length > 0) setRepsData(merged);
      });
    return () => { cancelled = true; };
  }, [localRepById]);

  // Election Watch is secondary to MandateWatch's core between-elections focus — only shown when
  // an admin has switched Election Mode on, via app_settings (public read, no auth required).
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_settings")
      .select("election_mode_enabled")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setElectionModeEnabled(data.election_mode_enabled);
      });
    return () => { cancelled = true; };
  }, []);

  // If Election Mode gets switched off while someone's sitting on that tab, don't leave them on a
  // now-hidden tab with no way back to it via the nav.
  useEffect(() => {
    if (!electionModeEnabled && tab === "election") navigate("/", { replace: true });
  }, [electionModeEnabled, tab, navigate]);

  async function handleToggleElectionMode() {
    const next = !electionModeEnabled;
    const { error } = await supabase.from("app_settings").update({ election_mode_enabled: next }).eq("id", true);
    if (error) return;
    setElectionModeEnabled(next);
  }

  // Hydrate the signed-in user's own claim requests, so "Claim & Verify" reflects a pending or
  // rejected request instead of always showing as available.
  useEffect(() => {
    if (!user) { setMyClaimStatus({}); return; }
    let cancelled = false;
    supabase
      .from("rep_claim_requests")
      .select("rep_id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "rejected"])
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setMyClaimStatus(Object.fromEntries(data.map((r) => [r.rep_id, r.status])));
      });
    return () => { cancelled = true; };
  }, [user]);

  // Admins only: every pending claim request, for the Admin panel's review tab.
  useEffect(() => {
    if (!isAdmin) { setPendingClaims([]); return; }
    let cancelled = false;
    supabase
      .from("rep_claim_requests")
      .select("id, rep_id, user_id, requester_name, requester_email, justification, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setPendingClaims(
          data.map((row) => ({
            id: row.id,
            repId: row.rep_id,
            userId: row.user_id,
            requesterName: row.requester_name,
            requesterEmail: row.requester_email,
            justification: row.justification,
            createdAt: row.created_at.slice(0, 10),
          }))
        );
      });
    return () => { cancelled = true; };
  }, [isAdmin]);

  // Hydrate which reps/fields the signed-in user has already voted on, so buttons still show
  // "already voted" after a reload — not just within the current session.
  useEffect(() => {
    if (!user) { setRepVotes({}); return; }
    let cancelled = false;
    supabase
      .from("rep_votes")
      .select("rep_id, field, direction")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        const votes = {};
        for (const v of data) {
          votes[v.rep_id] = { ...votes[v.rep_id], [v.field]: v.direction };
        }
        setRepVotes(votes);
      });
    return () => { cancelled = true; };
  }, [user]);

  // Live demands from Supabase, replacing the bundled DEMANDS mock data on load.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("demands")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setDemandsList(
          data.map((row) => ({
            id: row.id,
            repId: row.rep_id,
            title: row.title,
            description: row.description,
            submittedBy: row.submitted_by_name,
            submittedByLga: row.submitted_by_lga,
            upvotes: row.upvotes,
            status: row.status,
            attachmentNames: [], // attachments stay session-local, never uploaded — see SubmitDemandModal
            createdAt: row.created_at.slice(0, 10),
          }))
        );
      });
    return () => { cancelled = true; };
  }, []);

  // Hydrate which demands the signed-in user has already upvoted, so the button still shows
  // "already upvoted" after a reload — not just within the current session.
  useEffect(() => {
    if (!user) { setUpvotedIds([]); return; }
    let cancelled = false;
    supabase
      .from("demand_upvotes")
      .select("demand_id")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setUpvotedIds(data.map((row) => row.demand_id));
      });
    return () => { cancelled = true; };
  }, [user]);

  // Live threads + comments from Supabase, replacing the bundled THREADS/COMMENTS mock data.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("threads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setThreadsList(
          data.map((row) => ({
            id: row.id,
            repId: row.rep_id,
            issueTag: row.issue_tag,
            title: row.title,
            body: row.body,
            userId: row.user_id,
            author: row.author_name,
            score: row.score,
            createdAt: row.created_at.slice(0, 10),
          }))
        );
      });
    supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setCommentsList(
          data.map((row) => ({
            id: row.id,
            threadId: row.thread_id,
            parentId: row.parent_id,
            userId: row.user_id,
            author: row.author_name,
            body: row.body,
            score: row.score,
            isOfficial: row.is_official,
            createdAt: row.created_at.slice(0, 10),
          }))
        );
      });
    return () => { cancelled = true; };
  }, []);

  // Hydrate which threads/comments the signed-in user has already voted on, so buttons still show
  // "already voted" after a reload — not just within the current session.
  useEffect(() => {
    if (!user) { setThreadVotes({}); setCommentVotes({}); return; }
    let cancelled = false;
    supabase
      .from("thread_votes")
      .select("thread_id, direction")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setThreadVotes(Object.fromEntries(data.map((v) => [v.thread_id, v.direction])));
      });
    supabase
      .from("comment_votes")
      .select("comment_id, direction")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error || !data || cancelled) return;
        setCommentVotes(Object.fromEntries(data.map((v) => [v.comment_id, v.direction])));
      });
    return () => { cancelled = true; };
  }, [user]);

  async function handleRepVote(repId, field, direction) {
    if (!user) { setAuthOpen(true); return; }
    if (repVotes[repId]?.[field]) return; // already voted, RLS would reject this anyway

    // Optimistic local update first — the unique constraint on (rep_id, user_id, field) is the
    // real enforcement point; this is just responsive UI, corrected below if the insert fails.
    setRepVotes((prev) => ({ ...prev, [repId]: { ...prev[repId], [field]: direction } }));
    setRepsData((prev) =>
      prev.map((r) => {
        if (r.id !== repId) return r;
        const delta = direction === "up" ? 1 : -1;
        return { ...r, [field]: Math.max(0, Math.min(100, r[field] + delta)) };
      })
    );

    const { error } = await supabase.from("rep_votes").insert({ rep_id: repId, user_id: user.id, field, direction });
    if (error) {
      // Most likely a duplicate vote from another tab/device — revert the optimistic update
      // rather than leave the UI showing a vote that wasn't actually recorded.
      setRepVotes((prev) => {
        const next = { ...prev };
        if (next[repId]) { const { [field]: _drop, ...rest } = next[repId]; next[repId] = rest; }
        return next;
      });
      setRepsData((prev) =>
        prev.map((r) => {
          if (r.id !== repId) return r;
          const delta = direction === "up" ? -1 : 1;
          return { ...r, [field]: Math.max(0, Math.min(100, r[field] + delta)) };
        })
      );
    }
  }

  const filteredDemands = useMemo(() => {
    let list = demandsList.filter((d) => {
      const rep = repById[d.repId];
      const matchesState = demandStateFilter === "All" || (rep && rep.state === demandStateFilter);
      const matchesStatus = demandStatusFilter === "all" || d.status === demandStatusFilter;
      const matchesQuery =
        demandQuery.trim() === "" ||
        d.title.toLowerCase().includes(demandQuery.toLowerCase()) ||
        (rep && rep.name.toLowerCase().includes(demandQuery.toLowerCase()));
      return matchesState && matchesStatus && matchesQuery;
    });
    list = [...list].sort((a, b) =>
      demandSort === "top" ? b.upvotes - a.upvotes : new Date(b.createdAt) - new Date(a.createdAt)
    );
    return list;
  }, [demandsList, demandQuery, demandStateFilter, demandStatusFilter, demandSort, repById]);

  async function handleUpvote(demandId) {
    if (!user) { setAuthOpen(true); return; }
    if (upvotedIds.includes(demandId)) return;

    // Optimistic local update first — the unique constraint on (demand_id, user_id) is the real
    // enforcement point; this is just responsive UI, corrected below if the insert fails.
    setUpvotedIds((prev) => [...prev, demandId]);
    setDemandsList((prev) => prev.map((d) => (d.id === demandId ? { ...d, upvotes: d.upvotes + 1 } : d)));

    const { error } = await supabase.from("demand_upvotes").insert({ demand_id: demandId, user_id: user.id });
    if (error) {
      // Most likely a duplicate upvote from another tab/device — revert the optimistic update
      // rather than leave the UI showing an upvote that wasn't actually recorded.
      setUpvotedIds((prev) => prev.filter((id) => id !== demandId));
      setDemandsList((prev) => prev.map((d) => (d.id === demandId ? { ...d, upvotes: d.upvotes - 1 } : d)));
    }
  }

  async function handleAcknowledgeDemand(demandId, newStatus) {
    const { error } = await supabase.rpc("acknowledge_demand", { demand_id: demandId, new_status: newStatus });
    if (error) return;
    setDemandsList((prev) => prev.map((d) => (d.id === demandId ? { ...d, status: newStatus } : d)));
  }

  function handleAddRep(data) {
    const newId = Math.max(0, ...repsData.map((r) => r.id)) + 1;
    setRepsData((prev) => [
      ...prev,
      { id: newId, approval: 50, presence: 45, demands: 0, topDemand: "No demands filed yet — be the first.", status: "ON WATCH", ...data },
    ]);
  }

  function handleUpdateRep(id, data) {
    setRepsData((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
  }

  function handleAddAspirant(newAspirant) {
    setAspirantsList((prev) => [...prev, newAspirant]);
  }

  // Returns an error message string on failure (so ClaimRepModal can show it and stay open),
  // or null on success (so ClaimRepModal knows it can close itself).
  async function handleSubmitClaim(justification) {
    if (!user || !claimModalRepId) return "You need to be signed in to submit a claim.";
    const repId = claimModalRepId;

    const { error } = await supabase.from("rep_claim_requests").insert({
      rep_id: repId,
      user_id: user.id,
      requester_name: user.name,
      requester_email: user.email,
      justification,
    });
    if (error) return error.message; // e.g. a duplicate pending request from another tab

    setMyClaimStatus((prev) => ({ ...prev, [repId]: "pending" }));
    return null;
  }

  async function handleApproveClaim(requestId) {
    const { error } = await supabase.rpc("approve_rep_claim", { request_id: requestId });
    if (error) return;
    setPendingClaims((prev) => prev.filter((c) => c.id !== requestId));
    // Reflect the newly-claimed rep locally without a full refetch.
    const approved = pendingClaims.find((c) => c.id === requestId);
    if (approved) {
      setRepsData((prev) => prev.map((r) => (r.id === approved.repId ? { ...r, claimedBy: approved.userId } : r)));
    }
  }

  async function handleRejectClaim(requestId) {
    const { error } = await supabase.rpc("reject_rep_claim", { request_id: requestId });
    if (error) return;
    setPendingClaims((prev) => prev.filter((c) => c.id !== requestId));
  }

  function resumeRepView(repId) {
    setActiveRepView(repId);
  }

  function exitRepView() {
    setActiveRepView(null);
  }

  function handleAddStewardship({ title, description }) {
    if (!stewardshipRepId) return;
    const newEntry = {
      id: Date.now(),
      repId: stewardshipRepId,
      title,
      description,
      verifiedCount: 0,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    };
    setStewardshipList((prev) => [newEntry, ...prev]);
  }

  function handleVerifyStewardship(entryId) {
    if (verifiedStewardshipIds.includes(entryId)) return;
    setVerifiedStewardshipIds((prev) => [...prev, entryId]);
    setStewardshipList((prev) => prev.map((e) => (e.id === entryId ? { ...e, verifiedCount: e.verifiedCount + 1 } : e)));
  }

  async function handleSubmitDemand({ title, description, repId }) {
    if (!user) { setSubmitOpen(false); setAuthOpen(true); return; }

    const { data, error } = await supabase
      .from("demands")
      .insert({
        rep_id: repId,
        user_id: user.id,
        title,
        description: description || "No further details provided.",
        submitted_by_name: user.name,
        submitted_by_lga: user.lga,
      })
      .select()
      .single();
    if (error || !data) return;

    setDemandsList((prev) => [
      {
        id: data.id,
        repId: data.rep_id,
        title: data.title,
        description: data.description,
        submittedBy: data.submitted_by_name,
        submittedByLga: data.submitted_by_lga,
        upvotes: data.upvotes, // starts at 1 — the seed_demand_self_upvote() trigger already ran
        status: data.status,
        attachmentNames: [], // attachments stay session-local, never uploaded — see SubmitDemandModal
        createdAt: data.created_at.slice(0, 10),
      },
      ...prev,
    ]);
    setUpvotedIds((prev) => [...prev, data.id]);
    setSubmitOpen(false);
  }

  function openSubmitForRep(repId) {
    if (!user) { setAuthOpen(true); return; }
    setSubmitPrefillRepId(repId);
    setSubmitOpen(true);
  }

  const filteredAspirants = useMemo(() => {
    return aspirantsList.filter((a) => {
      const matchesState = aspirantStateFilter === "All" || a.state === aspirantStateFilter;
      const matchesQuery =
        aspirantQuery.trim() === "" ||
        a.name.toLowerCase().includes(aspirantQuery.toLowerCase()) ||
        a.race.toLowerCase().includes(aspirantQuery.toLowerCase()) ||
        a.party.toLowerCase().includes(aspirantQuery.toLowerCase());
      return matchesState && matchesQuery;
    });
  }, [aspirantsList, aspirantQuery, aspirantStateFilter]);

  const [myAreaOnly, setMyAreaOnly] = useState(false);
  const [mapSelectedState, setMapSelectedState] = useState(null);
  const repsGridRef = useRef(null);
  const mandateColRef = useRef(null);
  const [stewardshipList, setStewardshipList] = useState(STEWARDSHIP);
  const stewardshipRepIdMatch = location.pathname.match(/^\/representatives\/(\d+)\/stewardship/);
  const stewardshipRepId = stewardshipRepIdMatch ? Number(stewardshipRepIdMatch[1]) : null;
  const [verifiedStewardshipIds, setVerifiedStewardshipIds] = useState([]);
  const [mapHoveredState, setMapHoveredState] = useState(null);

  const filtered = useMemo(() => {
    return repsData.filter((r) => {
      const isPhase1 = PHASE1_CHAMBERS.includes(r.chamber);
      const matchesChamber = chamberFilter === "All" || r.chamber === chamberFilter;
      const matchesState = stateFilter === "All" || r.state === stateFilter;
      const matchesQuery =
        query.trim() === "" ||
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.state.toLowerCase().includes(query.toLowerCase()) ||
        r.constituency.toLowerCase().includes(query.toLowerCase());
      const matchesMyArea =
        !myAreaOnly || !user || repCoversArea(r, user.state, user.lga);
      return isPhase1 && matchesChamber && matchesState && matchesQuery && matchesMyArea;
    }).sort((a, b) => {
      const order = ["Governor", "Senate", "House of Reps", "State Assembly"];
      return order.indexOf(a.chamber) - order.indexOf(b.chamber);
    });
  }, [repsData, query, chamberFilter, stateFilter, myAreaOnly, user]);

  function handleVote(aspirant) {
    if (aspirantVotes[aspirant.race]) return;
    setAspirantVotes((prev) => ({ ...prev, [aspirant.race]: aspirant.id }));
    setVoteCounts((prev) => ({ ...prev, [aspirant.id]: (prev[aspirant.id] || 0) + 1 }));
  }

  return (
    <div className="mw-root">
      <style>{`
        .mw-root {
          --ink: ${platform.designTokens.colors.ink};
          --ink-soft: ${platform.designTokens.colors.inkSoft};
          --verdant: ${platform.designTokens.colors.verdant};
          --verdant-dark: ${platform.designTokens.colors.verdantDark};
          --brass: ${platform.designTokens.colors.brass};
          --brass-soft: ${platform.designTokens.colors.brassSoft};
          --brass-dark: ${platform.designTokens.colors.brassDark};
          --rust: ${platform.designTokens.colors.rust};
          --paper: ${platform.designTokens.colors.paper};
          --paper-card: ${platform.designTokens.colors.paperCard};
          --line: ${platform.designTokens.colors.line};
          font-family: 'Inter', sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
          padding: 0;
        }
        .mw-root * { box-sizing: border-box; }
        button, input, select, textarea {
          color: inherit; font: inherit;
        }

        .mw-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 28px; border-bottom: 1px solid var(--line);
          background: var(--paper); flex-wrap: wrap; row-gap: 10px;
        }
        .mw-wordmark { display: flex; align-items: center; }
        .mw-wordmark-logo { height: 80px; width: auto; display: block; }
        .mw-ticker {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.04em;
          color: var(--ink-soft); text-transform: uppercase; display: flex; gap: 18px;
          flex-wrap: wrap; row-gap: 4px;
        }
        .mw-ticker b { color: var(--ink); }

        .mw-hero {
          padding: 12px 28px 8px; border-bottom: none;
        }
        .mw-hero-split-text {
          max-width: 1080px; margin: 0 auto; display: flex; align-items: center; gap: 48px; flex-wrap: wrap;
        }
        .mw-hero-headline-col { flex: 1 1 380px; }
        .mw-hero-copy-col { flex: 1 1 380px; }
        .mw-hero-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--verdant); margin-bottom: 12px; display:block;
        }
        .mw-hero h1 {
          font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 27px; line-height: 1.08;
          letter-spacing: -0.02em; margin: 0; color: var(--ink);
        }
        .mw-hero-lead {
          font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 19px; color: var(--ink);
          line-height: 1.25; margin: 0 0 8px; letter-spacing: -0.01em;
        }
        .mw-hero-sub {
          font-family: 'Inter', sans-serif; font-weight: 600; color: var(--ink); font-size: 14px;
          line-height: 1.45; margin: 0;
        }

        .mw-hero-split {
          display: flex; align-items: flex-start; justify-content: center; gap: 32px;
          padding: 0 28px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap;
        }
        .mw-hero-map-section {
          display: flex; flex-direction: column; align-items: center; flex: 1 1 340px; min-width: 260px;
        }
        .mw-mandate-col { flex: 1 1 320px; max-width: 380px; display: flex; flex-direction: column; gap: 7px; padding-top: 0; }
        .mw-mandate-heading {
          font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 22px; letter-spacing: -0.02em;
          margin: 0 0 2px; color: var(--ink);
        }
        .mw-countdown {
          background: var(--paper-card); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px;
        }
        .mw-countdown-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--verdant); font-weight: 700; margin-bottom: 5px; line-height: 1.3;
        }
        .mw-countdown-digits { display: flex; gap: 6px; }
        .mw-countdown-unit {
          flex: 1; background: var(--paper); border: 1px solid var(--line); border-radius: 6px;
          padding: 4px 4px; text-align: center;
        }
        .mw-countdown-unit span {
          display: block; font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 15px; color: var(--ink);
        }
        .mw-countdown-unit label {
          display: block; font-family: 'IBM Plex Mono', monospace; font-size: 8px; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--ink-soft); margin-top: 1px;
        }
        .mw-countdown-date { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: var(--ink-soft); margin-top: 4px; text-align: right; }
        .mw-countdown-past { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-soft); padding: 8px 0; }

        .mw-vote-poll {
          background: var(--paper-card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px;
        }
        .mw-vote-poll-question { font-family: 'Archivo'; font-weight: 800; font-size: 14px; margin-bottom: 7px; }
        .mw-vote-poll-buttons { display: flex; gap: 10px; }
        .mw-vote-poll-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: var(--paper); border: 1.5px solid var(--line); border-radius: 8px; padding: 7px 8px;
          cursor: pointer; font-family: 'IBM Plex Mono', monospace; color: var(--ink);
        }
        .mw-vote-poll-btn span { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
        .mw-vote-poll-btn b { font-size: 11px; color: var(--ink-soft); font-weight: 600; }
        .mw-vote-poll-btn:disabled { cursor: default; }
        .mw-vote-poll-yes:hover:not(:disabled) { border-color: var(--verdant); color: var(--verdant); }
        .mw-vote-poll-no:hover:not(:disabled) { border-color: var(--rust); color: var(--rust); }
        .mw-vote-poll-chosen.mw-vote-poll-yes { background: rgba(31,94,63,0.1); border-color: var(--verdant); color: var(--verdant); }
        .mw-vote-poll-chosen.mw-vote-poll-no { background: rgba(166,67,46,0.1); border-color: var(--rust); color: var(--rust); }
        .mw-vote-poll-chosen b { color: inherit; }

        .mw-hero-map-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--ink-soft); text-align: center; margin-bottom: 4px; min-height: 16px;
        }
        .mw-hero-map-label b { color: var(--ink); font-weight: 800; font-size: 14px; letter-spacing: 0.02em; }
        .mw-map-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .mw-map-svg { width: 400px; max-width: 86vw; height: auto; }
        .mw-map-skeleton {
          width: 400px; max-width: 86vw; height: 322px; border-radius: 12px;
          background: linear-gradient(90deg, var(--paper-card) 25%, var(--line) 37%, var(--paper-card) 63%);
          background-size: 400% 100%; animation: mw-shimmer 1.4s ease infinite;
        }
        @media (prefers-reduced-motion: reduce) { .mw-map-skeleton { animation: none; } }
        @keyframes mw-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
        .mw-map-path {
          stroke: var(--paper); stroke-width: 1.5; cursor: pointer;
          transition: filter 0.12s;
        }
        .mw-map-path:hover, .mw-map-path:focus-visible { filter: brightness(0.88); }
        .mw-map-path:focus-visible { outline: none; stroke: var(--ink); stroke-width: 2; }
        .mw-map-path-selected { stroke: var(--paper); stroke-width: 1.5; }
        .mw-map-legend { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono'; font-size: 9px; color: var(--ink-soft); }
        .mw-map-legend-bar { width: 60px; height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--paper), var(--verdant)); border: 1px solid var(--line); }

        .stamp {
          font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 9.5px;
          letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 9px;
          border: 1.5px solid; border-radius: 3px; transform: rotate(-4deg);
          white-space: nowrap; display: inline-flex; align-items: center;
        }
        .stamp-verdant { color: var(--verdant); border-color: var(--verdant); background: rgba(31,94,63,0.06); }
        .stamp-brass { color: var(--brass); border-color: var(--brass); background: rgba(169,121,31,0.08); }
        .stamp-rust { color: var(--rust); border-color: var(--rust); background: rgba(166,67,46,0.08); }
        .stamp-navy { color: var(--ink); border-color: var(--ink); background: rgba(27,42,58,0.06); }
        .stamp-sm { font-size: 8.5px; padding: 4px 7px; }

        .mw-tabs { display: flex; gap: 4px; padding: 0 28px; border-bottom: 1px solid var(--line); }
        .mw-tab {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
          padding: 14px 4px; margin-right: 24px; background: none; border: none; cursor: pointer;
          color: var(--ink-soft); border-bottom: 2px solid transparent; font-weight: 600;
        }
        .mw-tab.active { color: var(--ink); border-bottom-color: var(--verdant); }

        .mw-toolbar { display: flex; gap: 12px; padding: 20px 28px; flex-wrap: wrap; align-items: center; }
        .mw-search { display: flex; align-items: center; gap: 8px; background: var(--paper-card); border: 1px solid var(--line); border-radius: 6px; padding: 9px 12px; flex: 1; min-width: 220px; }
        .mw-search:focus-within { border-color: var(--verdant); box-shadow: 0 0 0 2px rgba(31,94,63,0.15); }
        .mw-search input { border: none; background: none; outline: none; font-family: 'Inter'; font-size: 13.5px; color: var(--ink); width: 100%; }
        .mw-search input::placeholder { color: #97998a; }
        .mw-select {
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.02em;
          padding: 9px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--paper-card);
          color: var(--ink); font-weight: 600; cursor: pointer; min-width: 170px;
        }
        .mw-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .mw-chip {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
          padding: 7px 12px; border-radius: 5px; border: 1px solid var(--line); background: var(--paper-card);
          color: var(--ink-soft); cursor: pointer; font-weight: 600;
        }
        .mw-chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

        .mw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; padding: 4px 28px 40px; }

        .mw-card {
          text-align: left; background: var(--paper-card); border: 1px solid var(--line); border-radius: 10px;
          padding: 16px; cursor: pointer; transition: box-shadow 0.15s, transform 0.15s; font-family: inherit;
          display: flex; flex-direction: column; gap: 10px;
        }
        .mw-card:hover { box-shadow: 0 4px 14px rgba(27,42,58,0.08); transform: translateY(-1px); }
        .mw-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .mw-avatar {
          width: 40px; height: 40px; border-radius: 8px; background: var(--verdant); color: #fff;
          display: flex; align-items: center; justify-content: center; font-family: 'Archivo'; font-weight: 800; font-size: 14px;
        }
        .mw-avatar-gold { background: var(--brass); }
        .mw-avatar-lg { width: 56px; height: 56px; border-radius: 10px; font-size: 18px; }

        .mw-photo {
          width: 68px; height: 68px; border-radius: 10px; background: repeating-linear-gradient(135deg, #DDE0D2, #DDE0D2 4px, #E6E8DB 4px, #E6E8DB 8px);
          border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; position: relative;
          color: var(--ink-soft); font-family: 'Archivo'; font-weight: 800; font-size: 19px; flex-shrink: 0;
        }
        .mw-photo-tag {
          position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
          background: var(--ink); color: var(--paper); font-family: 'IBM Plex Mono'; font-size: 7px;
          text-transform: uppercase; letter-spacing: 0.04em; padding: 1.5px 5px; border-radius: 3px; white-space: nowrap;
        }
        .mw-photo-lg { width: 90px; height: 90px; border-radius: 12px; font-size: 24px; }
        .mw-photo-real { background: #fff; border: 1px solid var(--line); overflow: hidden; padding: 0; }
        .mw-photo-real img { width: 100%; height: 100%; object-fit: cover; }
        .mw-party-col { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .mw-party-name { font-family: 'Archivo'; font-weight: 800; font-size: 10px; letter-spacing: 0.01em; color: var(--ink); text-align: center; }
        .mw-party-badge {
          width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          color: #fff; font-family: 'IBM Plex Mono'; font-weight: 700; font-size: 7px; letter-spacing: 0.02em;
          flex-shrink: 0; text-align: center; line-height: 1;
        }
        .mw-party-badge-lg { width: 34px; height: 34px; border-radius: 8px; font-size: 8.5px; }
        .mw-party-logo {
          width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0; overflow: hidden;
          border: 1px solid var(--line); background: #fff; display: flex; align-items: center; justify-content: center;
        }
        .mw-party-logo img { width: 100%; height: 100%; object-fit: cover; }
        .mw-party-logo.mw-party-badge-lg { width: 34px; height: 34px; border-radius: 8px; }
        .mw-level-tag {
          font-family: 'IBM Plex Mono'; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em;
          font-weight: 600; color: var(--ink-soft); background: var(--paper); border: 1px solid var(--line);
          border-radius: 4px; padding: 2px 6px;
        }
        .mw-lga-chip-list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .mw-lga-chip {
          font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink); background: var(--paper);
          border: 1px solid var(--line); border-radius: 12px; padding: 3px 9px;
        }
        .mw-lga-chip-specific { background: var(--verdant); color: #fff; border-color: var(--verdant); font-weight: 700; }
        .mw-rep-full-title { font-size: 13px; color: var(--ink-soft); font-weight: 600; margin: 2px 0 4px; }
        .mw-term-row {
          font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-soft); letter-spacing: 0.01em;
          border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); padding: 6px 0;
        }
        .mw-state-link {
          background: none; border: none; padding: 0; margin: 0; font: inherit; color: var(--verdant);
          text-decoration: underline; cursor: pointer; font-size: 11px;
        }
        .mw-card-meta-sub { font-size: 11px; margin-top: 1px; color: var(--ink-soft); }
        .mw-bio { font-style: italic; margin-bottom: 4px !important; }
        .mw-manifesto-label { font-family: 'IBM Plex Mono'; font-weight: 600; color: var(--ink); text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
        .mw-card-name { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 16.5px; margin: 0; letter-spacing: -0.01em; }
        .mw-card-meta { font-size: 12px; color: var(--ink-soft); display: flex; align-items: center; gap: 5px; }
        .mw-dot { color: var(--line); }
        .mw-card-bars { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
        .mw-bar-label { display: flex; justify-content: space-between; font-size: 10.5px; font-family: 'IBM Plex Mono'; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-soft); margin-bottom: 3px; }
        .mw-bar-value { color: var(--ink); font-weight: 600; }
        .mw-bar-track { height: 5px; background: var(--line); border-radius: 3px; overflow: hidden; }
        .mw-bar-fill { height: 100%; border-radius: 3px; }
        .fill-verdant { background: var(--verdant); }
        .fill-brass { background: var(--brass); }
        .mw-card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--ink-soft); border-top: 1px dashed var(--line); padding-top: 10px; margin-top: 2px; }
        .mw-demand-count { display: flex; align-items: center; gap: 5px; }
        .mw-cert-date { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; border-top: none; padding-top: 0; }

        .mw-modal-backdrop { position: fixed; inset: 0; background: rgba(27,42,58,0.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .mw-modal { background: var(--paper-card); border-radius: 14px; padding: 28px; max-width: 480px; width: 100%; max-height: 88vh; overflow-y: auto; position: relative; border: 1px solid var(--line); }
        .mw-modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; color: var(--ink-soft); }

        .mw-page { padding: 24px 28px 48px; max-width: 720px; margin: 0 auto; }
        .mw-back-btn {
          display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer;
          font-family: 'IBM Plex Mono'; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em;
          font-weight: 600; color: var(--ink-soft); padding: 0; margin-bottom: 18px;
        }
        .mw-back-btn:hover { color: var(--ink); }
        .mw-page-card { background: var(--paper-card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; position: relative; }
        .mw-admin-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .mw-admin-form { display: flex; flex-direction: column; }
        .mw-admin-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mw-admin-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .mw-verified-badge {
          display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono'; font-size: 9.5px;
          text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700; color: var(--verdant);
          background: rgba(31,94,63,0.1); border: 1px solid var(--verdant); border-radius: 4px; padding: 2px 6px;
        }
        .mw-verify-toggle { width: 100%; }
        .mw-rep-demand-row { border-top: 1px dashed var(--line); padding: 10px 0; }
        .mw-rep-demand-row:first-child { border-top: none; }
        .mw-rep-demand-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .mw-rep-demand-title { font-size: 13px; color: var(--ink); }
        .mw-rep-thread-row {
          display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; background: none;
          border: none; border-top: 1px dashed var(--line); padding: 10px 0; cursor: pointer; font-family: inherit;
        }
        .mw-rep-thread-row:first-child { border-top: none; }

        .mw-stewardship-cta {
          display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
          background: rgba(169,121,31,0.1); border: 1.5px solid var(--brass); border-radius: 9px;
          padding: 13px 16px; cursor: pointer; color: var(--brass-dark); font-family: 'IBM Plex Mono', monospace;
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
        }
        .mw-stewardship-cta span { flex: 1; }
        .mw-stewardship-cta:hover { background: rgba(169,121,31,0.18); }
        .mw-stewardship-entry {
          background: var(--paper-card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
        }
        .mw-stewardship-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .mw-stewardship-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
        .mw-verify-btn {
          display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono'; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; padding: 7px 12px;
          border-radius: 7px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); cursor: pointer;
        }
        .mw-verify-btn:hover:not(:disabled) { border-color: var(--verdant); color: var(--verdant); }
        .mw-verify-btn:disabled { cursor: default; }
        .mw-verify-btn-active { background: rgba(31,94,63,0.1); border-color: var(--verdant); color: var(--verdant); }
        .mw-verify-stamp {
          display: inline-flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono', monospace;
          font-weight: 800; font-size: 11px; letter-spacing: 0.04em; color: var(--verdant);
          border: 2px solid var(--verdant); border-radius: 5px; padding: 5px 10px;
          background: rgba(31,94,63,0.08); transform: rotate(-2deg);
        }
        .mw-official-badge {
          display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono'; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700; color: var(--brass-dark);
          background: rgba(169,121,31,0.1); border: 1px solid var(--brass); border-radius: 4px; padding: 1px 5px; margin-left: 6px;
        }
        .mw-comment-row-official { background: rgba(169,121,31,0.06); border-radius: 8px; padding: 8px; margin: -8px; }
        .mw-modal-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
        .mw-modal-name { font-family: 'Archivo'; font-weight: 900; font-size: 20px; margin: 0 0 4px; color: var(--ink); }
        .mw-pulse-block { margin-bottom: 18px; }
        .mw-pulse-question { font-size: 11.5px; color: var(--ink-soft); margin: 6px 0 8px; }
        .mw-pulse-buttons { display: flex; gap: 8px; }
        .mw-pulse-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          font-family: 'IBM Plex Mono'; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;
          padding: 8px 10px; border-radius: 7px; border: 1px solid var(--line); background: var(--paper); color: var(--ink); cursor: pointer;
        }
        .mw-pulse-btn-up:hover { border-color: var(--verdant); color: var(--verdant); }
        .mw-pulse-btn-down:hover { border-color: var(--rust); color: var(--rust); }
        .mw-pulse-recorded {
          display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono'; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; padding: 8px 10px; border-radius: 7px;
        }
        .mw-pulse-up { background: rgba(31,94,63,0.08); color: var(--verdant); }
        .mw-pulse-down { background: rgba(166,67,46,0.08); color: var(--rust); }
        .mw-modal-section { margin-bottom: 20px; }
        .mw-section-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--verdant); margin-bottom: 8px; font-weight: 600; }
        .mw-demand-text { font-size: 14.5px; font-style: italic; color: var(--ink); margin: 0; line-height: 1.5; }
        .mw-file-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .mw-file-stats > div { background: var(--paper); border-radius: 8px; padding: 10px; text-align: center; }
        .mw-file-num { display: block; font-family: 'Archivo'; font-weight: 800; font-size: 15px; }
        .mw-file-label { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-soft); margin-top: 2px; font-family: 'IBM Plex Mono'; }
        .mw-modal-actions { display: flex; gap: 10px; }

        .mw-btn { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; padding: 10px 14px; border-radius: 7px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .mw-btn-primary { background: var(--verdant); color: #fff; flex: 1; }
        .mw-btn-ghost { background: none; border: 1px solid var(--line); color: var(--ink); flex: 1; }
        .mw-btn-vote { background: var(--ink); color: var(--paper); width: 100%; margin-top: 10px; }
        .mw-btn-vote:disabled { opacity: 0.55; cursor: default; }
        .mw-btn-voted { background: var(--verdant) !important; opacity: 1 !important; }

        .mw-file-btn { white-space: nowrap; }

        .mw-demand-list { display: flex; flex-direction: column; gap: 10px; padding: 4px 28px 40px; }
        .mw-demand-card {
          display: flex; gap: 14px; background: var(--paper-card); border: 1px solid var(--line);
          border-radius: 10px; padding: 14px 16px; align-items: flex-start;
        }
        .mw-upvote {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
          padding: 8px 10px; cursor: pointer; font-family: 'IBM Plex Mono'; font-weight: 700; font-size: 13px;
          color: var(--ink); flex-shrink: 0; min-width: 48px;
        }
        .mw-upvote-active { background: var(--verdant); border-color: var(--verdant); color: #fff; }
        .mw-upvote:disabled { cursor: default; }
        .mw-upvote-caption { font-family: 'IBM Plex Mono'; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; opacity: 0.75; }
        .mw-demand-body { flex: 1; min-width: 0; }
        .mw-demand-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .mw-demand-title { font-family: 'Archivo'; font-weight: 800; font-size: 15px; margin: 0; letter-spacing: -0.01em; }
        .mw-demand-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.45; margin: 6px 0 8px; }
        .mw-attachment-row {
          display: flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono'; font-size: 10.5px;
          color: var(--ink-soft); margin-bottom: 8px;
        }
        .mw-file-drop {
          display: flex; align-items: center; gap: 8px; border: 1px dashed var(--line); border-radius: 8px;
          padding: 10px 12px; cursor: pointer; font-size: 13px; color: var(--ink-soft); background: var(--paper);
        }
        .mw-file-drop:hover { border-color: var(--verdant); color: var(--verdant); }
        .mw-file-chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .mw-file-chip {
          display: flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono'; font-size: 10.5px;
          background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 3px 4px 3px 9px;
          color: var(--ink);
        }
        .mw-file-chip button { background: none; border: none; cursor: pointer; color: var(--ink-soft); display: flex; padding: 2px; }
        .mw-demand-footer { font-size: 11px; font-family: 'IBM Plex Mono'; color: var(--ink-soft); display: flex; gap: 6px; flex-wrap: wrap; }

        .mw-form-label { display: block; font-family: 'IBM Plex Mono'; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); margin: 14px 0 6px; font-weight: 600; }
        .mw-form-full { width: 100%; }
        .mw-form-input {
          width: 100%; font-family: 'Inter'; font-size: 13.5px; padding: 10px 12px; border-radius: 7px;
          border: 1px solid var(--line); background: var(--paper); color: var(--ink); outline: none;
        }
        .mw-form-input:focus { border-color: var(--verdant); }
        .mw-form-textarea { resize: vertical; min-height: 70px; font-family: 'Inter'; }
        .mw-btn-primary:disabled { opacity: 0.5; cursor: default; }
        .mw-form-error {
          font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--rust); margin-top: 6px;
        }
        .mw-form-hint {
          font-size: 11px; color: var(--ink-soft); margin-top: 4px; line-height: 1.4;
        }
        .mw-social-buttons { display: flex; flex-direction: column; gap: 8px; }
        .mw-social-btn {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
          border: 1px solid var(--line); border-radius: 7px; background: var(--paper-card); color: var(--ink);
          font-family: 'Inter'; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .mw-social-btn:hover { border-color: var(--ink-soft); }
        .mw-social-icon {
          width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
          color: #fff; font-family: 'Archivo'; font-weight: 800; font-size: 12px; flex-shrink: 0;
        }
        .mw-social-google { background: #C4472A; }
        .mw-social-facebook { background: #3B5BA5; }
        .mw-form-divider {
          display: flex; align-items: center; text-align: center; margin: 14px 0;
          font-family: 'IBM Plex Mono'; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft);
        }
        .mw-form-divider::before, .mw-form-divider::after { content: ""; flex: 1; border-top: 1px solid var(--line); }
        .mw-form-divider span { padding: 0 10px; }

        .mw-vote-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; padding-top: 2px; }
        .mw-vote-arrow { background: none; border: none; padding: 3px; cursor: pointer; color: var(--ink-soft); display: flex; }
        .mw-vote-arrow:disabled { cursor: default; opacity: 0.4; }
        .mw-vote-up-active { color: var(--verdant); }
        .mw-vote-down-active { color: var(--rust); }
        .mw-vote-score { font-family: 'IBM Plex Mono'; font-size: 11px; font-weight: 700; color: var(--ink); }

        .mw-thread-card {
          display: flex; gap: 12px; background: var(--paper-card); border: 1px solid var(--line);
          border-radius: 10px; padding: 14px 16px; align-items: flex-start;
        }
        .mw-thread-body { flex: 1; min-width: 0; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
        .mw-thread-tag {
          display: inline-block; font-family: 'IBM Plex Mono'; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em;
          font-weight: 600; color: var(--ink-soft); background: var(--paper); border: 1px solid var(--line);
          border-radius: 4px; padding: 2px 6px; margin-bottom: 6px;
        }

        .mw-comment-row { display: flex; gap: 10px; }
        .mw-comment-meta { font-family: 'IBM Plex Mono'; font-size: 10.5px; color: var(--ink-soft); }
        .mw-comment-body { font-size: 13px; color: var(--ink); line-height: 1.45; margin: 3px 0 4px; }
        .mw-comment-list { display: flex; flex-direction: column; gap: 14px; margin: 10px 0 16px; }
        .mw-comment-replies { margin: 8px 0 0 6px; padding-left: 12px; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
        .mw-reply-box { margin-top: 8px; background: var(--paper); border-radius: 8px; padding: 10px; }
        .mw-auth-btn { white-space: nowrap; flex: 0 0 auto; padding: 7px 14px; font-size: 10.5px; }
        .mw-auth-pill {
          display: flex; align-items: center; gap: 8px; font-family: 'IBM Plex Mono'; font-size: 11px;
          color: var(--verdant); background: rgba(31,94,63,0.08); border: 1px solid var(--verdant);
          border-radius: 20px; padding: 6px 12px; white-space: nowrap;
        }
        .mw-prefill-rep {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
          background: var(--paper); border: 1px dashed var(--line); border-radius: 8px; padding: 10px 12px;
          font-size: 13px; margin-top: 14px;
        }
        .mw-link-btn {
          background: none; border: none; padding: 0; font-family: 'IBM Plex Mono'; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.03em; color: var(--verdant); cursor: pointer; font-weight: 600;
          text-decoration: underline; white-space: nowrap;
        }

        .mw-aspirant-card { background: var(--paper-card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .mw-manifesto { font-size: 12.5px; color: var(--ink-soft); line-height: 1.4; margin: 2px 0 0; }

        .mw-election-banner {
          margin: 20px 28px 4px; background: var(--verdant-dark); color: var(--paper); border-radius: 10px;
          padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
        }
        .mw-election-banner-text { display: flex; align-items: center; gap: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
        .mw-election-results { display: flex; gap: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
        .mw-election-results b { font-size: 14px; }

        .mw-footer { padding: 20px 28px 32px; font-size: 11.5px; color: var(--ink-soft); border-top: 1px solid var(--line); margin-top: 8px; font-family: 'IBM Plex Mono', monospace; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .mw-footer-admin-link {
          background: none; border: 1px solid var(--line); border-radius: 5px; padding: 4px 10px;
          color: var(--ink-soft); font-family: 'IBM Plex Mono'; font-size: 10.5px; text-transform: uppercase;
          letter-spacing: 0.03em; cursor: pointer; flex-shrink: 0; white-space: nowrap;
        }
        .mw-footer-admin-link:hover { border-color: var(--ink-soft); color: var(--ink); }
        .mw-footer-columns { display: flex; gap: 28px; margin-top: 14px; flex-wrap: wrap; }
        .mw-footer-column { display: flex; flex-direction: column; gap: 4px; }
        .mw-footer-column-title { color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; font-size: 10.5px; margin-bottom: 2px; }
        .mw-footer-link { background: none; border: none; padding: 0; color: var(--ink-soft); font-family: 'IBM Plex Mono'; font-size: 11px; text-align: left; cursor: pointer; width: fit-content; }
        .mw-footer-link:hover { color: var(--ink); text-decoration: underline; }

        @media (max-width: 640px) {
          .mw-hero { padding: 24px 18px 20px; }
          .mw-hero-split-text { flex-direction: column; gap: 20px; text-align: center; }
          .mw-hero h1 { font-size: 28px; }
          .mw-hero-split { padding: 0 16px 24px; flex-direction: column; align-items: center; gap: 24px; }
          .mw-mandate-col { max-width: 100%; width: 100%; }
          .mw-map-svg { width: 360px; }
          .mw-header { padding: 14px 16px; }
          .mw-wordmark-logo { height: 56px; }
          .mw-ticker { font-size: 10px; gap: 8px 12px; width: 100%; }
          .mw-auth-btn { width: 100%; }
          .mw-auth-pill { width: 100%; justify-content: space-between; box-sizing: border-box; }

          .mw-tabs { padding: 0 16px; overflow-x: auto; }

          .mw-page { padding: 16px; }
          .mw-admin-grid-2, .mw-admin-grid-3 { grid-template-columns: 1fr; }
          .mw-tab { margin-right: 16px; white-space: nowrap; }

          .mw-toolbar { padding: 16px; gap: 8px; }
          .mw-search { min-width: 0; width: 100%; }
          .mw-select { width: 100%; min-width: 0; }
          .mw-chips { width: 100%; }
          .mw-file-btn { width: 100%; justify-content: center; }

          .mw-grid { grid-template-columns: 1fr; padding: 4px 16px 32px; gap: 12px; }
          .mw-election-banner { margin: 16px; padding: 14px 16px; }
          .mw-election-results { width: 100%; justify-content: space-between; }

          .mw-demand-list { padding: 4px 16px 32px; }
          .mw-demand-card { padding: 12px; gap: 10px; }
          .mw-demand-top { flex-direction: column; align-items: flex-start; gap: 6px; }
          .mw-demand-footer { gap: 4px; }

          .mw-modal { padding: 20px; max-width: 100%; width: calc(100% - 24px); }
          .mw-modal-header { flex-wrap: wrap; }
          .mw-file-stats { grid-template-columns: 1fr; gap: 6px; }
          .mw-modal-actions { flex-direction: column; }

          .mw-footer { padding: 16px 16px 24px; flex-direction: column; }
        }
      `}</style>

      <header className="mw-header">
        <div className="mw-wordmark"><img src={logo} alt="MandateWatch" className="mw-wordmark-logo" /></div>
        <div className="mw-ticker">
          <span><b>{phase1Reps.length}</b> officials tracked</span>
          <span><b>{demandsList.length}</b> demands filed</span>
          <span><b>{aspirantsList.length}</b> aspirants watched</span>
        </div>
        {user ? (
          <div className="mw-auth-pill">
            <button className="mw-link-btn" style={{ color: "var(--verdant)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }} onClick={() => navigate("/me")}>
              <CheckCircle2 size={13} />
              <span>{user.name} · {user.lga} LGA, {user.state}</span>
            </button>
            <button className="mw-link-btn" onClick={() => signOut()}>{platform.cta.signOut}</button>
          </div>
        ) : (
          <button className="mw-btn mw-btn-primary mw-auth-btn" onClick={() => setAuthOpen(true)}>{platform.cta.signInSignUp}</button>
        )}
      </header>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onComplete={(u) => { setUser(u); setAuthOpen(false); }}
        pendingAuthUser={needsProfile ? { id: authUser.id, email: authUser.email } : null}
      />

      {!knownPath && <NotFoundPage onGoHome={() => navigate("/")} />}

      {knownPath && !openRepId && !userProfileOpen && !stewardshipRepId && (
      <>
      <div className="mw-hero">
        <div className="mw-hero-split-text">
          <div className="mw-hero-headline-col">
            <h1>
              {platform.brand.brandPromise.split(". ").map((clause, i, arr) => (
                <React.Fragment key={i}>
                  {clause.replace(/\.\s*$/, "")}.
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </h1>
          </div>
          <div className="mw-hero-copy-col">
            <p className="mw-hero-lead">{platform.brand.mission}</p>
            <p className="mw-hero-sub">{platform.marketPosition}</p>
          </div>
        </div>
      </div>

      <Suspense fallback={<div style={{ minHeight: 800 }} />}>
        <HomepageStory
          phase1Reps={phase1Reps}
          demandsList={demandsList}
          threadsList={threadsList}
          repById={repById}
          user={user}
          onNavigate={(path) => { navigate(path); setTimeout(() => { if (repsGridRef.current) repsGridRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); }}
          onSignIn={() => setAuthOpen(true)}
        />
      </Suspense>

      {electionModeEnabled && (
        <div className="mw-hero-split">
          <div className="mw-mandate-col" ref={mandateColRef}>
            <h3 className="mw-mandate-heading">Next Mandate</h3>
            <CountdownTimer label="Presidential/National Assembly Election" date="2027-01-16T08:00:00" />
            <CountdownTimer label="Governorship/State House Of Assembly Election" date="2027-02-06T08:00:00" />
            <VotePoll />
          </div>
        </div>
      )}

      <div className="mw-tabs" ref={repsGridRef}>
        {platform.navigation.map((item) => (
          <Link key={item.key} to={item.path} className={`mw-tab ${location.pathname === item.path ? "active" : ""}`}>{item.label}</Link>
        ))}
        {electionModeEnabled && (
          <Link to="/election" className={`mw-tab ${tab === "election" ? "active" : ""}`}>Election Watch</Link>
        )}
      </div>

      {tab === "pulsemap" && (
        <div className="mw-hero-map-section">
          <div className="mw-hero-map-label">
            {mapSelectedState ? <b>{mapSelectedState}</b> : mapHoveredState ? <b>{mapHoveredState}</b> : "Tap a state"}
          </div>
          <NigeriaMap
            repsData={phase1Reps}
            onSelectState={(s) => {
              setMapSelectedState(s);
              setStateFilter(s);
              setTab("reps");
              setTimeout(() => {
                if (repsGridRef.current) repsGridRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
            hoveredState={mapHoveredState}
            onHoverState={setMapHoveredState}
            selectedState={mapSelectedState}
          />
        </div>
      )}

      {tab === "reps" && (
        <>
          <div className="mw-toolbar">
            <div className="mw-search">
              <Search size={15} color="#97998a" />
              <input placeholder="Search by name, state, or constituency…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="mw-select" aria-label="Filter representatives by region or state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="All">All regions &amp; states</option>
              {Object.entries(REGIONS).map(([region, states]) => (
                <optgroup key={region} label={region}>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="mw-chips">
              {CHAMBERS.map((c) => (
                <button key={c} className={`mw-chip ${chamberFilter === c ? "active" : ""}`} onClick={() => setChamberFilter(c)}>{c}</button>
              ))}
            </div>
            {user && (
              <button className={`mw-chip ${myAreaOnly ? "active" : ""}`} onClick={() => setMyAreaOnly((v) => !v)}>
                <MapPin size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                My area ({user.lga}, {user.state})
              </button>
            )}
          </div>
          {myAreaOnly && user && (
            <div className="mw-form-hint" style={{ padding: "0 28px 8px" }}>
              Showing reps whose real senatorial district, federal constituency, or state constituency covers "{user.lga}" LGA — sourced from INEC delimitation data, not just a single home-LGA guess. Governors always show since they cover the whole state. Matching relies on each rep's recorded constituency name lining up with the official district name, so a mismatch there could still hide a real match — see PRD §6 for what's fully verified vs. approximated.
            </div>
          )}
          <div className="mw-grid">
            {filtered.map((rep) => <RepCard key={rep.id} rep={rep} onOpen={(r) => setOpenRepId(r.id)} isClaimed={rep.claimedBy != null} />)}
            {filtered.length === 0 && (
              <div style={{ padding: "40px 0", color: "var(--ink-soft)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                {myAreaOnly ? "No reps match your area in the sample data yet." : "No officials match that search. Try a different name, state, or chamber."}
              </div>
            )}
          </div>
        </>
      )}

      {electionModeEnabled && tab === "election" && (
        <>
          <div className="mw-toolbar">
            <div className="mw-search">
              <Search size={15} color="#97998a" />
              <input placeholder="Search aspirants by name, party, or race…" value={aspirantQuery} onChange={(e) => setAspirantQuery(e.target.value)} />
            </div>
            <select className="mw-select" aria-label="Filter aspirants by region or state" value={aspirantStateFilter} onChange={(e) => setAspirantStateFilter(e.target.value)}>
              <option value="All">All regions &amp; states</option>
              {Object.entries(REGIONS).map(([region, states]) => (
                <optgroup key={region} label={region}>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {Object.entries(
            filteredAspirants.reduce((acc, a) => {
              acc[a.race] = acc[a.race] || [];
              acc[a.race].push(a);
              return acc;
            }, {})
          ).map(([race, group]) => {
            const raceVotes = group.reduce((sum, a) => sum + voteCounts[a.id], 0);
            return (
              <div key={race}>
                <div className="mw-election-banner">
                  <div className="mw-election-banner-text"><TrendingUp size={16} /> {race} — INEC certified candidate list</div>
                  <div className="mw-election-results">
                    <span>Pulse votes cast: <b>{raceVotes}</b></span>
                    <span className="mw-dot">·</span>
                    <span>Region: <b>{regionOf(group[0].state)}</b></span>
                  </div>
                </div>
                <div className="mw-grid" style={{ paddingTop: 20 }}>
                  {group.map((a) => (
                    <AspirantCard key={a.id} aspirant={a} votedId={aspirantVotes[a.race]} onVote={handleVote} />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredAspirants.length === 0 && (
            <div style={{ padding: "40px 28px", color: "var(--ink-soft)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
              No certified aspirants match that search yet.
            </div>
          )}

          <div style={{ padding: "12px 28px 8px", fontSize: 11.5, color: "var(--ink-soft)", fontFamily: "IBM Plex Mono" }}>
            Favorability shown here reflects citizen sentiment only — not an official result or projection.
          </div>
        </>
      )}

      {tab === "demands" && (
        <>
          <div className="mw-toolbar">
            <div className="mw-search">
              <Search size={15} color="#97998a" />
              <input placeholder="Search demands by title or representative…" value={demandQuery} onChange={(e) => setDemandQuery(e.target.value)} />
            </div>
            <select className="mw-select" aria-label="Filter demands by region or state" value={demandStateFilter} onChange={(e) => setDemandStateFilter(e.target.value)}>
              <option value="All">All regions &amp; states</option>
              {Object.entries(REGIONS).map(([region, states]) => (
                <optgroup key={region} label={region}>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="mw-chips">
              {["all", "open", "acknowledged", "delivered"].map((s) => (
                <button key={s} className={`mw-chip ${demandStatusFilter === s ? "active" : ""}`} onClick={() => setDemandStatusFilter(s)}>{s}</button>
              ))}
            </div>
            <div className="mw-chips">
              <button className={`mw-chip ${demandSort === "top" ? "active" : ""}`} onClick={() => setDemandSort("top")}>Most demanded</button>
              <button className={`mw-chip ${demandSort === "new" ? "active" : ""}`} onClick={() => setDemandSort("new")}>Newest</button>
            </div>
            <button className="mw-btn mw-btn-primary mw-file-btn" onClick={() => openSubmitForRep(null)}><Plus size={14} /> {platform.cta.fileADemand}</button>
          </div>

          <div className="mw-demand-list">
            {filteredDemands.map((d) => (
              <DemandCard key={d.id} demand={d} rep={repById[d.repId]} upvoted={upvotedIds.includes(d.id)} onUpvote={handleUpvote} />
            ))}
            {filteredDemands.length === 0 && (
              <div style={{ padding: "40px 28px", color: "var(--ink-soft)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                No demands match that search yet — be the first to file one.
              </div>
            )}
          </div>
        </>
      )}

      {tab === "discussion" && (
        <>
          <div className="mw-toolbar">
            <div className="mw-search">
              <Search size={15} color="#97998a" />
              <input placeholder="Search discussions by title or rep…" value={threadQuery} onChange={(e) => setThreadQuery(e.target.value)} />
            </div>
            {threadRepFilter && (
              <div className="mw-chips">
                <button className="mw-chip active" onClick={() => setThreadRepFilter(null)}>
                  {repById[threadRepFilter] ? repById[threadRepFilter].name : "Rep"} ✕
                </button>
              </div>
            )}
            <button className="mw-btn mw-btn-primary mw-file-btn" onClick={() => (user ? setNewThreadOpen(true) : setAuthOpen(true))}><Plus size={14} /> {platform.cta.startADiscussion}</button>
          </div>

          <div className="mw-demand-list">
            {threadsList
              .filter((t) => !threadRepFilter || t.repId === threadRepFilter)
              .filter((t) => {
                const q = threadQuery.trim().toLowerCase();
                if (!q) return true;
                const rep = t.repId ? repById[t.repId] : null;
                return t.title.toLowerCase().includes(q) || (rep && rep.name.toLowerCase().includes(q)) || (t.issueTag && t.issueTag.toLowerCase().includes(q));
              })
              .map((t) => (
                <ThreadCard
                  key={t.id}
                  thread={t}
                  rep={t.repId ? repById[t.repId] : null}
                  replyCount={commentsList.filter((c) => c.threadId === t.id).length}
                  myVote={threadVotes[t.id]}
                  onVote={handleVoteThread}
                  onOpen={setOpenThreadId}
                />
              ))}
            {threadsList.filter((t) => !threadRepFilter || t.repId === threadRepFilter).length === 0 && (
              <div style={{ padding: "40px 28px", color: "var(--ink-soft)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                No discussions yet — start one.
              </div>
            )}
          </div>
        </>
      )}

      {tab === "admin" && isAdmin && (
        <AdminPanel
          repsData={repsData}
          onAddRep={handleAddRep}
          onUpdateRep={handleUpdateRep}
          onAddAspirant={handleAddAspirant}
          demandsList={demandsList}
          threadsList={threadsList}
          commentsList={commentsList}
          aspirantsList={aspirantsList}
          pendingClaims={pendingClaims}
          onApproveClaim={handleApproveClaim}
          onRejectClaim={handleRejectClaim}
          electionModeEnabled={electionModeEnabled}
          onToggleElectionMode={handleToggleElectionMode}
        />
      )}
      </>
      )}

      {openRepId && openRep && (
        <RepProfilePage
          rep={openRep}
          onBack={() => setOpenRepId(null)}
          onFileDemand={(repId) => { navigate("/"); openSubmitForRep(repId); }}
          onStateClick={(state) => { setStateFilter(state); navigate("/"); }}
          onViewDiscussion={(repId) => { setThreadRepFilter(repId); navigate("/discussion"); }}
          onViewStewardship={(repId) => navigate(`/representatives/${repId}/stewardship`)}
          voteState={repVotes[openRep.id]}
          onVote={(field, dir) => handleRepVote(openRep.id, field, dir)}
          isClaimed={openRep.claimedBy != null}
          isOwner={ownsRep(openRep.id)}
          isActingAsRep={ownsRep(openRep.id) && activeRepView === openRep.id}
          claimStatus={myClaimStatus[openRep.id]}
          onClaim={() => (user ? setClaimModalRepId(openRep.id) : setAuthOpen(true))}
          onResumeView={() => resumeRepView(openRep.id)}
          onExitView={exitRepView}
          repDemands={demandsList.filter((d) => d.repId === openRep.id)}
          onAcknowledgeDemand={handleAcknowledgeDemand}
          repThreads={threadsList.filter((t) => t.repId === openRep.id)}
          commentsList={commentsList}
        />
      )}

      {stewardshipRepId && (
        <StewardshipPage
          rep={repById[stewardshipRepId]}
          entries={stewardshipList.filter((e) => e.repId === stewardshipRepId)}
          isActingAsRep={ownsRep(stewardshipRepId) && activeRepView === stewardshipRepId}
          verifiedIds={verifiedStewardshipIds}
          onAdd={handleAddStewardship}
          onVerify={handleVerifyStewardship}
          onBack={() => navigate(`/representatives/${stewardshipRepId}`)}
        />
      )}

      {userProfileOpen && user && (
        <UserProfilePage
          user={user}
          onBack={() => setUserProfileOpen(false)}
          onSignOut={() => { signOut(); navigate("/"); }}
          myDemands={demandsList.filter((d) => d.submittedBy === user.name)}
          myComments={commentsList.filter((c) => c.userId === user.id)}
          myVotedReps={Object.entries(repVotes).map(([repId, votes]) => ({ repId: Number(repId), votes }))}
          repById={repById}
        />
      )}

      <ThreadDetail
        thread={threadsList.find((t) => t.id === openThreadId) || null}
        rep={(() => {
          const t = threadsList.find((t) => t.id === openThreadId);
          return t && t.repId ? repById[t.repId] : null;
        })()}
        comments={commentsList.filter((c) => c.threadId === openThreadId)}
        threadVote={threadVotes[openThreadId]}
        commentVotes={commentVotes}
        onVoteThread={handleVoteThread}
        onVoteComment={handleVoteComment}
        onAddComment={handleAddComment}
        onClose={() => setOpenThreadId(null)}
        user={user}
        isVerifiedForThisRep={(() => {
          const t = threadsList.find((t) => t.id === openThreadId);
          return !!(t && t.repId && ownsRep(t.repId) && activeRepView === t.repId);
        })()}
      />
      <NewThreadModal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        onSubmit={(payload) => { handleStartThread(payload); setNewThreadOpen(false); }}
      />
      <ClaimRepModal
        rep={claimModalRepId ? repById[claimModalRepId] : null}
        onClose={() => setClaimModalRepId(null)}
        onSubmit={handleSubmitClaim}
      />

      <SubmitDemandModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleSubmitDemand}
        prefillRepId={submitPrefillRepId}
        user={user}
      />

      <footer className="mw-footer">
        <div>
          <div>
            {platform.footer.disclaimer} <ArrowUpRight size={11} style={{ display: "inline", verticalAlign: "middle" }} />
          </div>
          <div className="mw-footer-columns">
            {platform.footer.columns.filter((col) => col.links.length > 0).map((col) => (
              <div key={col.title} className="mw-footer-column">
                <div className="mw-footer-column-title">{col.title}</div>
                {col.links.map((link) => (
                  <Link key={link.label} to={link.path ?? "#"} className="mw-footer-link">{link.label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        {isAdmin && (
          <button
            className="mw-footer-admin-link"
            onClick={() => navigate("/admin")}
          >
            Admin
          </button>
        )}
      </footer>
    </div>
  );
}
