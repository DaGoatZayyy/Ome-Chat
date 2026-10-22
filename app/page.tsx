"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "video" | "text";
type Screen = "home" | "chat";

const countries = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"],
  ["AU", "Australia"], ["IN", "India"], ["DE", "Germany"], ["FR", "France"],
  ["BR", "Brazil"], ["JP", "Japan"], ["MX", "Mexico"], ["ANY", "Any country"]
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<Mode>("video");
  const [interests, setInterests] = useState("");
  const [country, setCountry] = useState("US");
  const [countryFilter, setCountryFilter] = useState(true);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [agePrompt, setAgePrompt] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [status, setStatus] = useState("Choose a chat mode to get started.");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [reported, setReported] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  async function start(modeChoice: Mode) {
    setMode(modeChoice);
    if (!ageConfirmed) {
      setAgePrompt(true);
      return;
    }
    setScreen("chat");
    setReported(false);
    setMessages([]);
    setCameraError("");
    if (modeChoice === "video") {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        setStatus("Camera and microphone ready. Matching is not configured yet.");
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "Camera or microphone permission was not granted.");
        setStatus("Video unavailable. You can switch to text chat.");
      }
    } else {
      setStatus("Text chat preview. Matching is not configured yet.");
    }
  }

  function endChat() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScreen("home");
    setStatus("Choose a chat mode to get started.");
  }

  function sendMessage() {
    const clean = message.trim();
    if (!clean) return;
    setMessages(prev => [...prev, clean]);
    setMessage("");
  }

  function toggleTrack(kind: "audio" | "video") {
    const track = streamRef.current?.getTracks().find(t => t.kind === kind);
    if (track) {
      track.enabled = !track.enabled;
      if (kind === "audio") setMuted(!track.enabled);
      else setCameraOff(!track.enabled);
    }
  }

  if (screen === "chat") {
    return (
      <main className="chat-shell">
        <header className="chat-header">
          <a className="brand" href="/" onClick={e => { e.preventDefault(); endChat(); }}>
            <span className="brand-icon">•••</span><span>OmeChat</span>
          </a>
          <div className="header-actions">
            <button className="icon-button" aria-label="Settings" onClick={() => setShowSettings(v => !v)}>⚙</button>
            <span className="pill">◉ {mode === "video" ? "Video" : "Text"} mode</span>
            <select aria-label="Country" value={country} onChange={e => setCountry(e.target.value)}>
              {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
        </header>
        <div className="chat-grid">
          <section className="video-column">
            <div className="remote-video">
              <div className="remote-placeholder"><span className="pulse-dot" /><strong>Waiting for a connection</strong><small>Live matching is not configured yet.</small></div>
              {mode === "video" && <video ref={localVideo} autoPlay muted playsInline className="local-video" />}
              {mode === "video" && cameraOff && <div className="camera-off">Camera off</div>}
            </div>
            <div className="video-controls">
              <button className={muted ? "round-control active" : "round-control"} onClick={() => toggleTrack("audio")} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? "Mic off" : "Mic on"}</button>
              <button className={cameraOff ? "round-control active" : "round-control"} onClick={() => toggleTrack("video")} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? "Cam off" : "Cam on"}</button>
              <button className="round-control danger" onClick={endChat}>End chat</button>
            </div>
          </section>
          <section className="conversation-panel">
            {cameraError && <div className="notice warning"><strong>Video access unavailable</strong><p>{cameraError}</p><button className="secondary-button" onClick={() => start("text")}>Switch to text</button></div>}
            <div className="status-banner"><span className="pulse-dot" />{status}</div>
            {showSettings && <div className="notice"><strong>Chat settings</strong><label className="check-row"><input type="checkbox" checked={countryFilter} onChange={e => setCountryFilter(e.target.checked)} /> Prefer people in {countries.find(c => c[0] === country)?.[1]}</label><p className="muted">Settings are saved for this session only.</p></div>}
            <div className="message-list">
              {messages.length === 0 ? <div className="empty-chat"><div className="empty-icon">✦</div><h2>{mode === "video" ? "Ready when you are" : "Start a conversation"}</h2><p>This is the interface preview. It does not connect you to strangers until a secure matching service is configured.</p></div> :
                messages.map((item, i) => <div className="message-bubble own" key={i}>{item}</div>)}
            </div>
            <div className="composer">
              <button className="new-chat" onClick={() => { setMessages([]); setStatus("No match available — matching backend not configured."); }}>New<br />Chat<span>Esc</span></button>
              <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMessage(); }} placeholder="Write a message..." aria-label="Message" />
              <button className="send-button" onClick={sendMessage} disabled={!message.trim()}>Send<span>Enter</span></button>
            </div>
            <div className="safety-row"><button onClick={() => { setReported(true); setStatus("Report recorded in this local preview only."); }}>⚑ Report user</button>{reported && <span>Preview only — no report was sent to a server.</span>}<span>Never share personal information.</span></div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="hero-section">
        <header className="site-header">
          <a className="brand" href="#"><span className="brand-icon">•••</span><span>OmeChat</span></a>
          <nav><a href="#how">How OmeChat works</a><a href="#faq">FAQ</a><a href="#safety">Safety</a></nav>
        </header>
        <div className="hero-grid">
          <section className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> A new way to connect</div>
            <h1>Random Video &amp; Text<br className="desktop-break" /> Chat with Strangers</h1>
            <p className="hero-description">Meet someone new on OmeChat, a simple place for video and text conversations. No account needed for this preview.</p>
            <div className="prompt-card"><span>A friendly debate</span><p>What’s a completely harmless opinion you’ll always defend?</p><button onClick={() => setInterests("Movies, music, friendly debates")}>Use these interests <span>↗</span></button></div>
            <div className="hero-stats"><div><strong>01</strong><span>Choose a mode</span></div><div><strong>02</strong><span>Set interests</span></div><div><strong>03</strong><span>Meet and chat</span></div></div>
          </section>
          <section className="start-card">
            <div className="card-heading"><span className="card-heading-icon">✦</span><div><h2>Choose text or video</h2><p>Start a new conversation</p></div></div>
            <button className="primary-button" onClick={() => start("video")}>Start video chat <span>→</span></button>
            <button className="secondary-button" onClick={() => start("text")}>Start text chat <span>→</span></button>
            <div className="card-divider" />
            <label htmlFor="interests">Add topics you’d like to talk about.</label>
            <input id="interests" className="field" value={interests} onChange={e => setInterests(e.target.value)} placeholder="Add your interests (optional)" maxLength={120} />
            <label htmlFor="country">Preferred country (optional)</label>
            <select id="country" className="field country-select" value={country} onChange={e => setCountry(e.target.value)}>
              {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <div className="age-note"><span>18+</span><p>You must be 18 or older to use this site. Read our <a href="#safety">safety guidelines</a>.</p></div>
            <p className="config-note">Preview build: live stranger matching is not enabled.</p>
          </section>
        </div>
      </div>
      <section className="how-section" id="how">
        <div className="section-inner"><div className="section-kicker">SIMPLE BY DESIGN</div><h2>How OmeChat works</h2><p className="section-intro">Choose a chat mode, add topics if you like, and stay in control of your conversation.</p>
          <div className="steps-grid"><article><strong>01</strong><h3>Pick your chat mode</h3><p>Choose video or text, depending on what works for you.</p></article><article><strong>02</strong><h3>Add interests</h3><p>Share a few topics to help guide the conversation.</p></article><article><strong>03</strong><h3>Start chatting</h3><p>Use the conversation controls to manage your session.</p></article><article><strong>04</strong><h3>Leave anytime</h3><p>End a conversation whenever you want to stop.</p></article></div>
        </div>
      </section>
      <section className="safety-section" id="safety"><div className="safety-content"><div className="safety-icon">盾</div><div><div className="section-kicker">YOUR SAFETY MATTERS</div><h2>Keep conversations respectful</h2><p>Never share your home address, school, passwords, financial details, or other identifying information. Leave any conversation that makes you uncomfortable and report abusive behavior. Do not record or share another person’s video without their permission.</p></div></div></section>
      <section className="faq-section" id="faq"><div className="section-inner"><div className="section-kicker">GOOD TO KNOW</div><h2>Frequently asked questions</h2><details><summary>Do I need an account?</summary><p>This interface preview does not require an account. A production service may require an account or additional checks to help protect users.</p></details><details><summary>Why is video access unavailable?</summary><p>Your browser will ask for camera and microphone permission. If you deny permission or have no available device, switch to text chat. Camera access requires HTTPS outside localhost.</p></details><details><summary>Is live matching enabled?</summary><p>No. This repository currently contains the interface preview only. A secure matching backend, real-time signaling, age assurance, and moderation operations must be configured before public launch.</p></details></div></section>
      <footer><a className="brand" href="#"><span className="brand-icon">•••</span><span>OmeChat</span></a><span>Built for respectful conversations.</span><span>18+ only</span></footer>
      {agePrompt && <div className="modal-backdrop" role="presentation"><div className="age-modal" role="dialog" aria-modal="true" aria-labelledby="age-title"><div className="modal-symbol">18+</div><h2 id="age-title">Before you continue</h2><p>OmeChat is intended for adults aged 18 and older. This checkbox is only a self-declaration and does not verify age.</p><label className="check-row"><input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} /> I confirm that I am 18 or older.</label><div className="modal-actions"><button className="secondary-button" onClick={() => setAgePrompt(false)}>Go back</button><button className="primary-button" disabled={!ageConfirmed} onClick={() => { setAgePrompt(false); void start(mode); }}>Continue <span>→</span></button></div><small>Do not continue if you are under 18.</small></div></div>}
    </main>
  );
}
