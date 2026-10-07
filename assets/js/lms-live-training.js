import { CallClient, LocalVideoStream, VideoStreamRenderer } from "https://cdn.jsdelivr.net/npm/@azure/communication-calling@1.46.1/+esm";
import { AzureCommunicationTokenCredential } from "https://cdn.jsdelivr.net/npm/@azure/communication-common@2.5.0/+esm";

const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
const REAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";
const db = window.supabase.createClient(SUPABASE_URL, REAL_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
    storageKey: "s4u-training-auth-session",
  },
});

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const state = {
  appointment: null,
  callClient: null,
  callAgent: null,
  deviceManager: null,
  call: null,
  localVideo: null,
  localRenderer: null,
  cameraOn: false,
  micOn: true,
  remoteRenderers: new Map(),
};

const FONT_KEY = "s4u_lms_font_size";
const FONT_DEFAULT = 14;
const FONT_MIN = 12;
const FONT_MAX = 18;

const navItems = [
  ["lms-dashboard.html", "Dashboard", "⌂"],
  ["lms-my-courses.html", "My Courses", "▶"],
  ["lms-courses.html", "Course Library", "▦"],
  ["lms-progress.html", "Progress", "◉"],
  ["lms-certificates.html", "Certificates", "✓"],
  ["lms-live-training.html", "Live Training", "●"],
  ["lms-my-appointments.html", "Appointments", "◷"],
  ["lms-group-seats.html", "Group Seats", "♙"],
  ["lms-documents.html", "Documents", "▤"],
  ["lms-orders.html", "Orders", "≡"],
  ["lms-notifications.html", "Notifications", "✉"],
  ["lms-account.html", "Account", "○"],
  ["lms-support.html", "Support", "?"],
];

function icon(name, className = "") {
  const common = `class="lt-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const icons = {
    calendar: `<svg ${common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    users: `<svg ${common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    chart: `<svg ${common}><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5" rx="1"/><rect x="12" y="9" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>`,
    cap: `<svg ${common}><path d="M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/></svg>`,
    user: `<svg ${common}><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
    tag: `<svg ${common}><path d="M20.59 13.41 11 3.83V3H4v7h.83l9.58 9.59a2 2 0 0 0 2.82 0l3.36-3.36a2 2 0 0 0 0-2.82z"/><circle cx="7.5" cy="6.5" r=".5" fill="currentColor"/></svg>`,
    lock: `<svg ${common}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
    video: `<svg ${common}><path d="m16 13 5 3V8l-5 3z"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg>`,
    mic: `<svg ${common}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8"/></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    checklist: `<svg ${common}><path d="M9 11l2 2 4-4"/><path d="M9 17l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3V1h6v2"/></svg>`,
    headset: `<svg ${common}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19c0 1.1-.9 2-2 2h-2"/><rect x="3" y="13" width="4" height="6" rx="2"/><rect x="17" y="13" width="4" height="6" rx="2"/></svg>`,
    help: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/></svg>`,
    chat: `<svg ${common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-3V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/></svg>`,
  };
  return icons[name] || "";
}

function readFontSize() {
  const n = Number(localStorage.getItem(FONT_KEY));
  return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : FONT_DEFAULT;
}

function applyFontSize(n) {
  const v = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(n) || FONT_DEFAULT));
  document.documentElement.style.setProperty("--portal-font-root", v + "px");
  localStorage.setItem(FONT_KEY, String(v));
  const el = $("fontSizeValue");
  if (el) el.textContent = v === FONT_DEFAULT ? "Default" : String(v);
  return v;
}

let portalFontSize = applyFontSize(readFontSize());

function renderShell() {
  const links = navItems.map(([href, label, navIcon]) =>
    `<a href="${href}"${href === "lms-live-training.html" ? ' class="active" aria-current="page"' : ""}><span class="ico">${navIcon}</span><span>${esc(label)}</span></a>`
  ).join("");

  $("trainingPortalApp").innerHTML = `
    <div class="app">
      <aside class="side">
        <div class="brand"><img src="images/training-logo.png" alt="screenings4u Learning Center"></div>
        <nav class="nav"><div class="nav-title">SCREENINGS4U LEARNING CENTER</div>${links}</nav>
        <div class="side-foot"><div>Portal</div><strong>lms.screenings4u.com</strong></div>
      </aside>
      <main class="main">
        <header class="top">
          <div class="top-left">
            <button class="menu" id="menu" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileNav"><span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span></button>
            <div class="top-context"><span class="top-eyebrow">SCREENINGS4U LEARNING CENTER</span><span class="crumb">Live Training</span></div>
          </div>
          <div class="top-right">
            <div class="portal-clock"><span id="portalClockDate" class="portal-clock-date"></span><strong id="portalClockTime" class="portal-clock-time"></strong></div>
            <div class="font-sizer"><button id="fontDown" type="button">A−</button><button class="font-reset" id="fontSizeValue" type="button">Default</button><button id="fontUp" type="button">A+</button></div>
            <span class="pill">LEARNER</span><a class="top-support" href="lms-support.html">Support</a><button class="signout" id="logout" type="button">Sign out</button>
          </div>
        </header>
        <section class="mobile-nav" id="mobileNav" aria-hidden="true"><div class="mobile-nav-inner"><div class="mobile-nav-head"><div><span>Portal navigation</span><strong>SCREENINGS4U LEARNING CENTER</strong></div><span class="mobile-nav-current">Live Training</span></div><nav class="mobile-nav-links">${links}</nav><div class="mobile-nav-foot"><span>lms.screenings4u.com</span><small>Select a page to close this menu.</small></div></div></section>
        <div class="content live-page-content">
          <section class="live-hero">
            <div class="live-hero-copy">
              <span class="live-hero-kicker">SCREENINGS4U LEARNING CENTER</span>
              <h1>Live Training</h1>
              <p>Join and manage your scheduled instructor-led training session.</p>
              <div class="live-hero-features">
                <div class="hero-feature"><span class="hero-feature-icon orange">${icon("calendar")}</span><div><strong>Real-time instruction</strong><span>Learn from certified trainers</span></div></div>
                <div class="hero-feature"><span class="hero-feature-icon blue">${icon("users")}</span><div><strong>Ask questions</strong><span>Interactive Q&amp;A sessions</span></div></div>
                <div class="hero-feature"><span class="hero-feature-icon orange">${icon("chart")}</span><div><strong>Build your skills</strong><span>Gain hands-on knowledge</span></div></div>
              </div>
            </div>
            <div class="live-hero-visual" aria-hidden="true">
              <div class="hero-orbit one"></div><div class="hero-orbit two"></div>
              <div class="hero-screen"><div class="hero-screen-cap">${icon("cap")}</div><strong>screenings4u | Learning Center</strong></div>
            </div>
          </section>
          <section id="liveContent" class="live-content"><div class="live-loading"><span></span><strong>Loading live training…</strong></div></section>
        </div>
      </main>
    </div>`;
}

function bindShell() {
  $("fontDown")?.addEventListener("click", () => portalFontSize = applyFontSize(portalFontSize - 1));
  $("fontUp")?.addEventListener("click", () => portalFontSize = applyFontSize(portalFontSize + 1));
  $("fontSizeValue")?.addEventListener("click", () => portalFontSize = applyFontSize(FONT_DEFAULT));
  const menu = $("menu");
  const mobile = $("mobileNav");
  menu?.addEventListener("click", () => {
    const open = !mobile.classList.contains("open");
    mobile.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
    mobile.setAttribute("aria-hidden", String(!open));
  });
  mobile?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    mobile.classList.remove("open");
    menu?.setAttribute("aria-expanded", "false");
    mobile.setAttribute("aria-hidden", "true");
  }));
  $("logout")?.addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("https://lms.screenings4u.com/training-login.html");
  });
}

function startClock() {
  const tick = () => {
    const n = new Date();
    $("portalClockDate").textContent = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(n);
    $("portalClockTime").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(n);
  };
  tick();
  setInterval(tick, 1000);
}

async function invoke(body) {
  const { data, error } = await db.functions.invoke("lms-live-training-session", { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context?.clone?.().json())?.error || message; } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function fmt(v, tz, opts = {}) {
  if (!v) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", ...opts }).format(new Date(v));
  } catch { return new Date(v).toLocaleString(); }
}

function timeOnly(v, tz) {
  if (!v) return "";
  try { return new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, hour: "numeric", minute: "2-digit" }).format(new Date(v)); }
  catch { return new Date(v).toLocaleTimeString(); }
}

function initials(name) {
  const p = String(name || "S4U").trim().split(/\s+/).filter(Boolean);
  return (p.slice(0, 2).map((x) => x[0]).join("") || "S4U").toUpperCase();
}

function renderAppointment(a) {
  state.appointment = a;
  const joinAllowed = !!a.join_allowed;
  const openTime = fmt(a.join_available_at, a.timezone);
  const openClock = timeOnly(a.join_available_at, a.timezone);

  $("liveContent").innerHTML = `
    <div id="liveMessage" class="live-message" hidden></div>
    <div class="live-dashboard-grid">
      <section class="session-overview-card">
        <div class="session-heading-row">
          <div class="session-cap">${icon("cap")}</div>
          <div><span class="section-kicker">TRAINING SESSION</span><h2>${esc(a.title || "Live Training")}</h2><p>Instructor-led training session with live instruction and interactive learning.</p></div>
        </div>
        <div class="session-detail-table">
          <div class="session-detail-row"><span class="detail-icon">${icon("calendar")}</span><span class="detail-label">Session time</span><strong>${esc(fmt(a.start_at, a.timezone))}</strong></div>
          ${a.host_name ? `<div class="session-detail-row"><span class="detail-icon">${icon("user")}</span><span class="detail-label">Instructor</span><strong>${esc(a.host_name)}</strong></div>` : ""}
          ${a.tracking_number ? `<div class="session-detail-row"><span class="detail-icon">${icon("tag")}</span><span class="detail-label">Tracking</span><strong>${esc(a.tracking_number)}</strong></div>` : ""}
        </div>
      </section>

      <aside class="session-status-card">
        <div class="status-banner ${joinAllowed ? "ready" : "scheduled"}"><span class="status-icon">${icon(joinAllowed ? "video" : "calendar")}</span><div><span class="section-kicker">SESSION STATUS</span><h2>${joinAllowed ? "Ready to join" : "Scheduled"}</h2><p>${joinAllowed ? "Your live training room is available now." : "Your live training session is confirmed."}</p></div></div>
        <div class="room-open-panel"><span class="room-icon">${icon(joinAllowed ? "video" : "lock")}</span><div><strong>${joinAllowed ? "Your training room is open" : `Room opens at ${esc(openClock)}`}</strong><p>${joinAllowed ? "You can enter the live session now." : `You'll be able to join the live session starting ${esc(openTime)}.`}</p></div></div>
        ${joinAllowed ? `<button class="join-live-primary" id="openPrejoin" type="button">${icon("video")}<span>Join Live Session</span></button>` : `<button class="join-live-primary disabled" type="button" disabled>${icon("video")}<span>Join Live Session</span></button>`}
        <div class="status-divider"></div>
        <a class="my-appointments-btn" href="lms-my-appointments.html">${icon("calendar")}<span>My Appointments</span></a>
      </aside>
    </div>

    <div class="live-support-grid">
      <section class="before-you-join-card">
        <div class="support-card-heading"><span class="support-heading-icon green">${icon("checklist")}</span><div><h3>Before you join</h3><p>Make sure you're ready for the best learning experience.</p></div></div>
        <div class="prep-items">
          <div class="prep-item"><span class="prep-icon blue">${icon("mic")}</span><div><strong>Test your microphone</strong><span>Make sure your audio is working properly.</span></div></div>
          <div class="prep-item"><span class="prep-icon green">${icon("video")}</span><div><strong>Allow camera access</strong><span>Enable your camera when prompted.</span></div></div>
          <div class="prep-item"><span class="prep-icon orange">${icon("clock")}</span><div><strong>Sign in early</strong><span>The room opens 30 minutes before the session.</span></div></div>
        </div>
      </section>
      <aside class="need-help-card">
        <div class="support-card-heading"><span class="support-heading-icon blue">${icon("headset")}</span><div><h3>Need help?</h3><p>We're here to help you have a smooth training experience.</p></div></div>
        <div class="help-links">
          <a href="lms-support.html"><span class="help-link-icon">${icon("help")}</span><div><strong>Visit our Support Center</strong><span>Get answers to common questions.</span></div><span class="help-arrow">↗</span></a>
          <a href="lms-support.html"><span class="help-link-icon">${icon("chat")}</span><div><strong>Contact Support</strong><span>Still need help? Our team is here for you.</span></div><span class="help-arrow">↗</span></a>
        </div>
      </aside>
    </div>

    ${joinAllowed ? `
      <section class="prejoin-grid redesigned-prejoin" id="prejoinState" hidden>
        <section class="preview-panel"><div class="preview-head"><div><span class="section-kicker">DEVICE CHECK</span><h2>Camera & microphone</h2></div></div><div class="preview-stage" id="localPreview"><div class="video-placeholder"><span id="previewInitials">${esc(initials(a.display_name))}</span><p>Camera preview</p></div></div><div class="preview-controls"><button id="cameraBtn" type="button">Camera</button><button id="micBtn" type="button">Mic on</button></div></section>
        <aside class="join-panel"><div class="join-head"><span class="section-kicker">READY TO ENTER</span><h2>${a.display_name ? `Welcome, ${esc(a.display_name)}` : "Ready to join"}</h2></div><div class="join-body"><div class="live-detail-list">${a.host_name ? `<div class="live-detail"><span>Instructor</span><strong>${esc(a.host_name)}</strong></div>` : ""}<div class="live-detail"><span>Session</span><strong>${esc(fmt(a.start_at, a.timezone))}</strong></div></div><button class="join-button" id="joinBtn" type="button">Enter Waiting Room</button></div></aside>
      </section>
      <section class="meeting-panel" id="meetingState" hidden><div class="meeting-head"><div><span class="section-kicker">LIVE SESSION</span><strong id="meetingStatus">Connecting…</strong></div><button class="leave-button" id="leaveBtn" type="button">Leave Training</button></div><div class="meeting-body"><div class="lobby-panel" id="lobbyPanel" hidden><h2>Waiting for your instructor</h2><p>You are checked in and will be admitted when the session is ready.</p></div><div id="connectedPanel" hidden style="width:100%"><div class="remote-gallery" id="remoteGallery"><div class="remote-empty" id="emptyRemote">Connected. Video participants will appear here.</div></div><div class="meeting-controls"><button id="meetingMicBtn" type="button">Mute</button><button id="meetingCameraBtn" type="button">Start Camera</button></div></div></div></section>` : ""}`;

  if (joinAllowed) bindSessionControls();
}

function renderEmpty() {
  $("liveContent").innerHTML = `<section class="empty-live-card"><div class="session-cap">${icon("calendar")}</div><span class="section-kicker">LIVE TRAINING</span><h2>No upcoming Live Training</h2><p>You do not currently have a scheduled live training session.</p><div class="empty-live-actions"><a class="join-live-primary as-link" href="lms-schedule-appointment.html">Schedule Appointment</a><a class="my-appointments-btn" href="lms-my-appointments.html">My Appointments</a></div></section>`;
}

function bindSessionControls() {
  $("openPrejoin")?.addEventListener("click", async () => {
    $("prejoinState").hidden = false;
    await initializePreview();
    $("prejoinState").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("cameraBtn")?.addEventListener("click", togglePreviewCamera);
  $("micBtn")?.addEventListener("click", () => { state.micOn = !state.micOn; updateControls(); });
  $("joinBtn")?.addEventListener("click", joinMeeting);
  $("leaveBtn")?.addEventListener("click", leaveMeeting);
  $("meetingMicBtn")?.addEventListener("click", toggleMeetingMic);
  $("meetingCameraBtn")?.addEventListener("click", toggleMeetingCamera);
}

async function initializePreview() {
  try {
    state.callClient = new CallClient();
    state.deviceManager = await state.callClient.getDeviceManager();
    await state.deviceManager.askDevicePermission({ audio: true, video: true });
    const cams = await state.deviceManager.getCameras();
    if (cams.length) {
      state.localVideo = new LocalVideoStream(cams[0]);
      state.cameraOn = true;
      await renderLocalPreview();
    }
    updateControls();
  } catch {
    showMessage("Camera or microphone permission was not granted. You can still join and allow access when prompted.");
  }
}

async function renderLocalPreview() {
  if (!state.localVideo) return;
  try {
    state.localRenderer?.dispose();
    const renderer = new VideoStreamRenderer(state.localVideo);
    const view = await renderer.createView({ scalingMode: "Crop" });
    state.localRenderer = renderer;
    const box = $("localPreview");
    box.innerHTML = "";
    box.appendChild(view.target);
  } catch (e) { console.warn(e); }
}

async function togglePreviewCamera() {
  try {
    if (state.cameraOn) {
      state.localRenderer?.dispose();
      state.localRenderer = null;
      state.localVideo = null;
      state.cameraOn = false;
      $("localPreview").innerHTML = `<div class="video-placeholder"><span>${esc(initials(state.appointment?.display_name))}</span><p>Camera is off</p></div>`;
    } else {
      const cams = await state.deviceManager.getCameras();
      if (!cams.length) throw new Error("No camera was found.");
      state.localVideo = new LocalVideoStream(cams[0]);
      state.cameraOn = true;
      await renderLocalPreview();
    }
    updateControls();
  } catch (e) { showMessage(e.message); }
}

function updateControls() {
  if ($("cameraBtn")) $("cameraBtn").textContent = state.cameraOn ? "Camera on" : "Camera off";
  if ($("micBtn")) $("micBtn").textContent = state.micOn ? "Mic on" : "Mic off";
}

async function joinMeeting() {
  const btn = $("joinBtn");
  btn.disabled = true;
  btn.textContent = "Opening waiting room…";
  try {
    const data = await invoke({ action: "token", appointment_id: state.appointment.id });
    const credential = new AzureCommunicationTokenCredential(data.acs.token);
    if (!state.callClient) state.callClient = new CallClient();
    if (!state.deviceManager) state.deviceManager = await state.callClient.getDeviceManager();
    state.callAgent = await state.callClient.createCallAgent(credential, { displayName: data.appointment.display_name || "Learner" });
    state.call = state.callAgent.join({ meetingLink: data.meeting_url }, {
      audioOptions: { muted: !state.micOn },
      videoOptions: state.cameraOn && state.localVideo ? { localVideoStreams: [state.localVideo] } : undefined,
    });
    subscribeCall();
    $("prejoinState").hidden = true;
    $("meetingState").hidden = false;
    setMeetingState(state.call.state);
  } catch (e) {
    showMessage(e.message || "Unable to join Live Training.");
    btn.disabled = false;
    btn.textContent = "Enter Waiting Room";
  }
}

function subscribeCall() {
  const call = state.call;
  call.on("stateChanged", () => setMeetingState(call.state));
  call.on("remoteParticipantsUpdated", (e) => (e.added || []).forEach(subscribeParticipant));
  (call.remoteParticipants || []).forEach(subscribeParticipant);
}

function setMeetingState(s) {
  $("meetingStatus").textContent = s === "InLobby" ? "Waiting for instructor" : s === "Connected" ? "Connected" : s === "Disconnected" ? "Training ended" : "Connecting…";
  $("lobbyPanel").hidden = s !== "InLobby";
  $("connectedPanel").hidden = s !== "Connected";
}

function subscribeParticipant(p) {
  (p.videoStreams || []).forEach((stream) => subscribeRemoteStream(p, stream));
  p.on?.("videoStreamsUpdated", (e) => (e.added || []).forEach((stream) => subscribeRemoteStream(p, stream)));
}

async function subscribeRemoteStream(p, stream) {
  if (!stream.isAvailable) return;
  try {
    const key = `${p.displayName || "participant"}:${stream.id}`;
    if (state.remoteRenderers.has(key)) return;
    const renderer = new VideoStreamRenderer(stream);
    const view = await renderer.createView({ scalingMode: "Crop" });
    const tile = document.createElement("div");
    tile.className = "remote-tile";
    tile.appendChild(view.target);
    const label = document.createElement("span");
    label.className = "remote-name";
    label.textContent = p.displayName || "Participant";
    tile.appendChild(label);
    $("remoteGallery").appendChild(tile);
    $("emptyRemote").hidden = true;
    state.remoteRenderers.set(key, { renderer, tile });
  } catch (e) { console.warn(e); }
}

async function toggleMeetingMic() {
  if (!state.call) return;
  try {
    if (state.call.isMuted) { await state.call.unmute(); $("meetingMicBtn").textContent = "Mute"; }
    else { await state.call.mute(); $("meetingMicBtn").textContent = "Unmute"; }
  } catch (e) { showMessage(e.message); }
}

async function toggleMeetingCamera() {
  if (!state.call) return;
  try {
    if (state.localVideo && state.call.localVideoStreams?.length) {
      await state.call.stopVideo(state.localVideo);
      $("meetingCameraBtn").textContent = "Start Camera";
    } else {
      if (!state.localVideo) {
        const cams = await state.deviceManager.getCameras();
        if (!cams.length) throw new Error("No camera was found.");
        state.localVideo = new LocalVideoStream(cams[0]);
      }
      await state.call.startVideo(state.localVideo);
      $("meetingCameraBtn").textContent = "Stop Camera";
    }
  } catch (e) { showMessage(e.message); }
}

async function leaveMeeting() {
  try { if (state.call) await state.call.hangUp(); }
  catch {}
  finally { location.href = "lms-my-appointments.html"; }
}

function showMessage(text) {
  const el = $("liveMessage");
  if (el) { el.textContent = text; el.hidden = false; }
}

async function init() {
  renderShell();
  bindShell();
  startClock();
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  if (!data?.session?.user?.id) {
    location.replace("https://lms.screenings4u.com/training-login.html?returnTo=%2Flms-live-training.html");
    return;
  }
  try {
    let appointmentId = new URLSearchParams(location.search).get("appointment");
    if (!appointmentId) {
      const upcoming = await invoke({ action: "upcoming" });
      if (!upcoming.appointment) { renderEmpty(); return; }
      appointmentId = upcoming.appointment.id;
      history.replaceState(null, "", `lms-live-training.html?appointment=${encodeURIComponent(appointmentId)}`);
    }
    const details = await invoke({ action: "details", appointment_id: appointmentId });
    renderAppointment(details.appointment);
  } catch (e) {
    console.error("[LMS Live Training]", e);
    $("liveContent").innerHTML = `<div class="live-error-card"><strong>Unable to open Live Training</strong><p>${esc(e.message || "Please try again.")}</p><a href="lms-my-appointments.html">Return to My Appointments</a></div>`;
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
