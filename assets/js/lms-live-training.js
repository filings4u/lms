/* SOURCE: assets/js/lms-core-clean.js?v=20260915-clean3 */
/* SOURCE: assets/js/supabase-config.js */
/* SCREENINGS4U — TRAINING SUPABASE CONFIG — SESSION STORAGE ONLY */
(() => {
  "use strict";

  const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscGJueXRwY2lxbmJleGlhZWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTYwMzQsImV4cCI6MjEwNTg3MjAzNH0.kWzPDxpdeorkJJpP6pvt4LCP-W9uGGVAgcQVVheVuE8";

  window.SCREENINGS4U_SUPABASE_URL = SUPABASE_URL;
  window.SCREENINGS4U_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  if (
    !window.screenings4uSupabase &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    window.screenings4uSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage,
          storageKey: "s4u-training-auth-session"
        }
      }
    );
  }

  window.supabaseClient = window.screenings4uSupabase;

  window.getScreenings4uSupabase = function () {
    if (window.screenings4uSupabase) {
      return window.screenings4uSupabase;
    }

    throw new Error(
      "Supabase client is not initialized. Load @supabase/supabase-js before supabase-config.js."
    );
  };
})();

;
/* SOURCE: assets/js/core-auth.js */
/* ============================================================
   SCREENINGS4U — CORE AUTH
   TRAINING / LMS AUTHENTICATION

   PORTAL:
   - Training / LMS

   IMPORTANT:
   This copy is isolated to the standalone Training system.
   It never routes to Admin, Customer, Employer, or Employee portals.

   ============================================================ */

(() => {
  "use strict";

  /* ============================================================
     PORTAL CONFIGURATION
     ============================================================ */

  const PORTALS = Object.freeze({

    training: {
      login: "training-login.html",
      dashboard: "lms-dashboard.html",
      allowedRoles: []
    }

  });


  /* ============================================================
     AUTH STATE
     ============================================================ */

  let state = {
    initialized: false,
    session: null,
    user: null,
    profile: null,
    roles: [],
    primaryRole: null
  };


  /* ============================================================
     SUPABASE CLIENT
     ============================================================ */

  function getClient() {

    if (
      typeof window.getScreenings4uSupabase === "function"
    ) {
      return window.getScreenings4uSupabase();
    }

    if (
      window.screenings4uSupabase &&
      window.screenings4uSupabase.auth
    ) {
      return window.screenings4uSupabase;
    }

    if (
      window.supabaseClient &&
      window.supabaseClient.auth
    ) {
      return window.supabaseClient;
    }

    throw new Error(
      "Supabase client is not available. " +
      "Load Supabase and supabase-config.js before core-auth.js."
    );

  }


  /* ============================================================
     ROLE NORMALIZATION
     ============================================================ */

  function normalizeRole(value) {

    if (!value) {
      return null;
    }

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  }


  function uniqueRoles(values = []) {

    return [
      ...new Set(
        values
          .map(normalizeRole)
          .filter(Boolean)
      )
    ];

  }


  /* ============================================================
     GET PORTAL
     ============================================================ */

  function getPortal(portalName) {

    const name = String(portalName || "")
      .trim()
      .toLowerCase();

    const portal = PORTALS[name];

    if (!portal) {
      throw new Error(
        `Unknown portal "${portalName}".`
      );
    }

    return {
      name,
      ...portal
    };

  }


  /* ============================================================
     GET SESSION
     ============================================================ */

  async function getSession() {

    const client = getClient();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session || null;

  }


  /* ============================================================
     GET USER PROFILE

     The central profile table is user_profiles.
     This function does NOT require a nonexistent
     admin_profiles table.
     ============================================================ */

  async function getProfile(userId = null) {

    const client = getClient();

    let id = userId;

    if (!id) {

      const session = await getSession();

      if (!session?.user?.id) {
        return null;
      }

      id = session.user.id;

    }

    const {
      data,
      error
    } = await client
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {

      console.warn(
        "[S4UAuth] Unable to load user profile:",
        error
      );

      return null;

    }

    return data || null;

  }


  /* ============================================================
     GET USER ROLES

     Roles are loaded from:

     user_role_assignments
     ============================================================ */

  async function getRoles(userId = null) {

    const client = getClient();

    let id = userId;

    if (!id) {

      const session = await getSession();

      if (!session?.user?.id) {
        return [];
      }

      id = session.user.id;

    }


    const {
      data,
      error
    } = await client
      .from("user_role_assignments")
      .select("*")
      .eq("user_id", id);


    if (error) {

      console.error(
        "[S4UAuth] Unable to load user roles:",
        error
      );

      return [];

    }


    const foundRoles = [];

    (data || []).forEach((row) => {

      [
        row.role,
        row.role_name,
        row.role_code,
        row.role_key,
        row.app_role
      ].forEach((value) => {

        const role = normalizeRole(value);

        if (role) {
          foundRoles.push(role);
        }

      });

    });


    return uniqueRoles(foundRoles);

  }


  /* ============================================================
     CHECK PORTAL ACCESS

     This is the central authorization check.

     ADMIN:
       Any recognized administrative role.

     CUSTOMER:
       Customer role only.

     EMPLOYER:
       Employer role only.

     EMPLOYEE:
       Employee role only.
       Employee dashboard is LMS only.
     ============================================================ */

  function userCanAccessPortal(
    userRoles = [],
    portalName
  ) {

    const name = normalizeRole(portalName);

    if (name !== "training") {
      return false;
    }

    /*
      Training access is NOT decided by ordinary roles here.
      It is checked asynchronously through hasRole("training"),
      which calls can_access_training_portal().
    */
    return false;

  }


  /* ============================================================
     GET PRIMARY ROLE
     ============================================================ */

  function getPrimaryRole(userRoles = []) {

    /*
      This copy of core-auth.js is used only inside the
      standalone Training / LMS system.

      Do not infer or route to another portal from this file.
    */
    return "training";

  }


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize({
    force = false
  } = {}) {

    if (
      state.initialized &&
      !force
    ) {
      return {
        ...state,
        roles: [...state.roles]
      };
    }


    const session =
      await getSession();


    /* ----------------------------------------------------------
       NO SESSION
       ---------------------------------------------------------- */

    if (!session?.user) {

      state = {
        initialized: true,
        session: null,
        user: null,
        profile: null,
        roles: [],
        primaryRole: null
      };

      return {
        ...state,
        roles: []
      };

    }


    /* ----------------------------------------------------------
       AUTHENTICATED USER
       ---------------------------------------------------------- */

    const user =
      session.user;


    // Training authorization is handled by can_access_training_portal().
    // Do not fetch role assignments on every LMS page navigation.
    const profile = await getProfile(user.id);
    const roles = [];


    state = {

      initialized: true,

      session,

      user,

      profile,

      roles,

      primaryRole:
        getPrimaryRole(roles)

    };


    return {
      ...state,
      roles: [...roles]
    };

  }


  /* ============================================================
     HAS ROLE
     ============================================================ */

  async function hasRole(
    role,
    userId = null
  ) {

    const requestedRole = normalizeRole(role);
    if (!requestedRole) return false;

    if (requestedRole === "training") {
      const client = getClient();
      const { data, error } = await client.rpc("can_access_training_portal");
      if (error) {
        console.error("[S4UAuth] Training access check failed:", error);
        throw error;
      }

      return data === true;
    }

    const userRoles = await getRoles(userId);


    return userRoles.includes(
      requestedRole
    );

  }


  /* ============================================================
     HAS ANY ROLE
     ============================================================ */

  async function hasAnyRole(
    allowedRoles = [],
    userId = null
  ) {

    const allowed =
      uniqueRoles(allowedRoles);

    if (!allowed.length) {
      return false;
    }


    const userRoles =
      await getRoles(userId);


    return userRoles.some(
      (role) => allowed.includes(role)
    );

  }


  /* ============================================================
     GET DASHBOARD
     ============================================================ */

  function getDashboardForRole(role) {

    const normalizedRole = normalizeRole(role);

    if (
      !normalizedRole ||
      normalizedRole !== "training"
    ) {
      return null;
    }

    return PORTALS.training.dashboard;

  }


  /* ============================================================
     GET LOGIN PAGE
     ============================================================ */

  function getLoginForPortal(
    portalName = "training"
  ) {

    const name = normalizeRole(portalName);

    if (name !== "training") {
      return PORTALS.training.login;
    }

    return PORTALS.training.login;

  }




  /* ============================================================
     SAFE RETURN-TO SUPPORT
     ============================================================ */

  function getCurrentReturnTo() {

    return (
      window.location.pathname +
      window.location.search +
      window.location.hash
    );

  }


  function buildLoginRedirect(
    loginPage,
    { preserveReturnTo = true } = {}
  ) {

    const loginUrl = new URL(
      loginPage,
      window.location.origin + "/"
    );

    if (preserveReturnTo) {

      const currentPage =
        window.location.pathname
          .split("/")
          .filter(Boolean)
          .pop()
          ?.toLowerCase() || "";

      /*
       * Never send public authentication pages back to themselves.
       */
      if (
        currentPage !== "training-login.html" &&
        currentPage !== "reset-password.html"
      ) {
        loginUrl.searchParams.set(
          "returnTo",
          getCurrentReturnTo()
        );
      }
    }

    return loginUrl.href;

  }


  /* ============================================================
     REQUIRE AUTHENTICATION

     Example:

     S4UAuth.requireAuth({
       portal: "admin"
     });

     If there is no session, redirect to the portal login.
     If access is explicitly denied, sign out and redirect.
     Authorization/network errors are thrown and must not be
     converted into a false access-denied result.
     ============================================================ */

  async function requireAuth({
    portal = "training",
    loginPage = null
  } = {}) {

    let portalConfig = null;


    if (portal) {

      portalConfig =
        getPortal(portal);

    }


    const resolvedLoginPage =

      loginPage ||

      portalConfig?.login ||

      PORTALS.training.login;


    /* ----------------------------------------------------------
       LOAD AUTH STATE ONCE
       initialize() performs the single session lookup.
       ---------------------------------------------------------- */

    const authState = await initialize({ force: true });

    if (!authState?.session?.user) {
      window.location.replace(buildLoginRedirect(resolvedLoginPage));
      return null;
    }


    /* ----------------------------------------------------------
       NO PORTAL SPECIFIED
       ---------------------------------------------------------- */

    if (!portalConfig) {

      return authState;

    }


    /* ----------------------------------------------------------
       STRICT PORTAL ACCESS
       ---------------------------------------------------------- */

    const allowed =
      await hasRole(
        "training",
        authState.user?.id
      );


    if (!allowed) {

      console.warn(
        "[S4UAuth] Portal access denied.",
        {
          portal,
          userId:
            authState.user?.id,
          roles:
            authState.roles
        }
      );


      await signOutSilently();


      window.location.replace(
        buildLoginRedirect(
          resolvedLoginPage
        )
      );


      return null;

    }


    return authState;

  }


  /* ============================================================
     SIGN IN
     ============================================================ */

  async function signIn(
    email,
    password
  ) {

    const client =
      getClient();


    const {
      data,
      error
    } = await client
      .auth
      .signInWithPassword({

        email:
          String(
            email || ""
          ).trim(),

        password

      });


    if (error) {
      throw error;
    }


    /* Refresh auth state immediately */

    await initialize({
      force: true
    });


    return data;

  }


  /* ============================================================
     STRICT PORTAL SIGN IN

     IMPORTANT:

     The user is authenticated first.

     Then the user's roles are checked.

     If they do not belong to the portal:
     - session is destroyed
     - an error is returned
     - no other portal redirect occurs
     ============================================================ */

  async function signInToPortal(
    portalName,
    email,
    password
  ) {

    const requestedPortal =
      normalizeRole(portalName);

    if (requestedPortal !== "training") {
      throw new Error(
        "This authentication file is restricted to the Training Portal."
      );
    }

    const portal =
      getPortal("training");


    const result =
      await signIn(
        email,
        password
      );


    const authState =
      await initialize({
        force: true
      });


    if (!authState?.user?.id) {

      await signOutSilently();

      throw new Error(
        "Unable to verify your account."
      );

    }


    const authorized =
      await hasRole(
        "training",
        authState.user.id
      );


    if (!authorized) {

      console.warn(
        "[S4UAuth] Login denied for portal.",
        {
          portal:
            portalName,
          userId:
            authState.user.id,
          roles:
            authState.roles
        }
      );


      await signOutSilently();


      throw new Error(
        "This account does not have access to the training portal."
      );

    }


    return {

      ...result,

      portal,

      state:
        authState

    };

  }


  /* ============================================================
     SILENT SIGN OUT
     ============================================================ */

  async function signOutSilently() {

    try {

      const client =
        getClient();


      await client.auth.signOut();


    } catch (error) {

      console.error(
        "[S4UAuth] Unable to sign out:",
        error
      );

    }


    state = {

      initialized: true,
      session: null,
      user: null,
      profile: null,
      roles: [],
      primaryRole: null

    };

  }


  /* ============================================================
     SIGN OUT
     ============================================================ */

  async function signOut(loginPage = "training-login.html") {

    const destination =
      typeof loginPage === "object" && loginPage !== null
        ? loginPage.redirectTo || "training-login.html"
        : loginPage || "training-login.html";

    await signOutSilently();
    window.location.replace(destination);
  }


  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.S4UAuth = Object.freeze({

    /* Client */

    getClient,


    /* Session */

    getSession,


    /* State */

    initialize,


    /* User */

    getProfile,


    /* Roles */

    getRoles,

    hasRole,

    hasAnyRole,

    normalizeRole,

    userCanAccessPortal,

    getPrimaryRole,


    /* Portals */

    PORTALS,

    getPortal,

    getDashboardForRole,

    getLoginForPortal,


    /* Protection */

    requireAuth,


    /* Authentication */

    signIn,

    signInToPortal,

    signOut,

    signOutSilently

  });

})();
;

/* SOURCE: assets/js/pages/lms-live-training.js?v=20260915-clean3 */
import { CallClient, LocalVideoStream, VideoStreamRenderer } from "https://cdn.jsdelivr.net/npm/@azure/communication-calling@1.46.1/+esm";
import { AzureCommunicationTokenCredential } from "https://cdn.jsdelivr.net/npm/@azure/communication-common@2.5.0/+esm";

const $=id=>document.getElementById(id);
const state={db:null,appointment:null,callClient:null,callAgent:null,deviceManager:null,call:null,localVideo:null,localRenderer:null,cameraOn:false,micOn:true,remoteRenderers:new Map()};

document.addEventListener("DOMContentLoaded",init);

async function init(){
  state.db=await getClient();
  if(!state.db){showError("Unable to connect to the Learning Center.");return;}
  bind();
  try{
    let appointmentId=new URLSearchParams(location.search).get("appointment");
    if(!appointmentId){
      const upcoming=await invoke({action:"upcoming"});
      if(!upcoming.appointment){showEmpty();return;}
      appointmentId=upcoming.appointment.id;
      history.replaceState(null,"",`lms-live-training.html?appointment=${encodeURIComponent(appointmentId)}`);
    }
    const data=await invoke({action:"details",appointment_id:appointmentId});
    state.appointment=data.appointment;
    renderDetails();
    if(state.appointment.join_allowed){$("prejoinState").hidden=false;await initializePreview();}
    else renderScheduled();
  }catch(e){showError(e.message||"Unable to open Live Training.");}
}

function bind(){
  $("cameraBtn")?.addEventListener("click",togglePreviewCamera);
  $("micBtn")?.addEventListener("click",()=>{state.micOn=!state.micOn;updatePrejoinControls();});
  $("joinBtn")?.addEventListener("click",joinMeeting);
  $("leaveBtn")?.addEventListener("click",leaveMeeting);
  $("meetingMicBtn")?.addEventListener("click",toggleMeetingMic);
  $("meetingCameraBtn")?.addEventListener("click",toggleMeetingCamera);
}

async function getClient(){for(let i=0;i<50;i++){try{if(typeof window.getScreenings4uSupabase==="function"){const c=await window.getScreenings4uSupabase();if(c?.functions)return c}if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;if(window.supabaseClient?.functions)return window.supabaseClient}catch{}await new Promise(r=>setTimeout(r,80));}return null;}
async function invoke(body){const {data,error}=await state.db.functions.invoke("lms-live-training-session",{body});if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}if(data?.error)throw new Error(data.error);return data;}
async function invokeBooking(body){const {data,error}=await state.db.functions.invoke("scheduling-booking",{body});if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}if(data?.error)throw new Error(data.error);return data;}

function renderDetails(){const a=state.appointment;$("trainingTitle").textContent=a.title||"Live Training";$("trainingSchedule").textContent=formatRange(a.start_at,a.end_at,a.timezone);$("welcomeName").textContent=`Welcome, ${a.display_name||"Learner"}`;$("hostName").textContent=a.host_name||"Screenings4u Training";$("trackingNumber").textContent=a.tracking_number||"—";$("sessionTime").textContent=formatRange(a.start_at,a.end_at,a.timezone);const initials=getInitials(a.display_name);$("previewInitials").textContent=initials;$("lobbyInitials").textContent=initials;$("lobbyName").textContent=a.display_name||"Learner";}
function renderScheduled(){const a=state.appointment;$("scheduledState").hidden=false;$("scheduledCopy").textContent=`Your room opens ${formatDate(a.join_available_at,a.timezone)}. Your appointment starts ${formatDate(a.start_at,a.timezone)}.`;}
function showEmpty(){$("trainingTitle").textContent="No upcoming Live Training";$("trainingSchedule").textContent="Schedule a training appointment to create your Microsoft Teams room.";$("liveMessage").hidden=true;$("scheduledState").hidden=false;$("scheduledCopy").innerHTML='You do not have an upcoming Microsoft Teams training appointment. <a href="lms-schedule-appointment.html">Schedule an appointment</a> to continue.';}
function formatDate(v,tz){try{return new Intl.DateTimeFormat("en-US",{timeZone:tz||undefined,weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(v))}catch{return new Date(v).toLocaleString()}}
function formatRange(s,e,tz){return `${formatDate(s,tz)} – ${new Intl.DateTimeFormat("en-US",{timeZone:tz||undefined,hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(e))}`}
function getInitials(name){const parts=String(name||"S4U").trim().split(/\s+/).filter(Boolean);return (parts.slice(0,2).map(x=>x[0]).join("")||"S4U").toUpperCase()}

async function initializePreview(){try{state.callClient=new CallClient();state.deviceManager=await state.callClient.getDeviceManager();await state.deviceManager.askDevicePermission({audio:true,video:true});const cameras=await state.deviceManager.getCameras();if(cameras.length){state.localVideo=new LocalVideoStream(cameras[0]);state.cameraOn=true;await renderLocalPreview();}updatePrejoinControls();}catch(e){console.warn("Device preview unavailable",e);showMessage("Camera or microphone permission was not granted. You can still join and allow access when prompted.");}}
async function renderLocalPreview(){if(!state.localVideo)return;try{if(state.localRenderer){state.localRenderer.dispose();state.localRenderer=null;}const renderer=new VideoStreamRenderer(state.localVideo),view=await renderer.createView({scalingMode:"Crop"});state.localRenderer=renderer;const box=$("localPreview");box.innerHTML="";box.appendChild(view.target);}catch(e){console.warn("Preview render failed",e)}}
async function togglePreviewCamera(){try{if(!state.callClient)state.callClient=new CallClient();if(!state.deviceManager)state.deviceManager=await state.callClient.getDeviceManager();if(state.cameraOn){state.localRenderer?.dispose();state.localRenderer=null;state.localVideo=null;state.cameraOn=false;$("localPreview").innerHTML=`<div class="video-placeholder"><span>${getInitials(state.appointment?.display_name)}</span><p>Camera is off</p></div>`;}else{const cams=await state.deviceManager.getCameras();if(!cams.length)throw new Error("No camera was found.");state.localVideo=new LocalVideoStream(cams[0]);state.cameraOn=true;await renderLocalPreview();}updatePrejoinControls();}catch(e){showMessage(e.message)}}
function updatePrejoinControls(){if(!$("cameraBtn")||!$("micBtn"))return;$("cameraBtn").setAttribute("aria-pressed",String(state.cameraOn));$("micBtn").setAttribute("aria-pressed",String(state.micOn));$("micBtn").querySelector("small").textContent=state.micOn?"Mic on":"Mic off";$("cameraBtn").querySelector("small").textContent=state.cameraOn?"Camera on":"Camera off";}

async function joinMeeting(){const btn=$("joinBtn");btn.disabled=true;btn.textContent="Opening waiting room…";try{const data=await invoke({action:"token",appointment_id:state.appointment.id});const credential=new AzureCommunicationTokenCredential(data.acs.token);if(!state.callClient)state.callClient=new CallClient();if(!state.deviceManager)state.deviceManager=await state.callClient.getDeviceManager();state.callAgent=await state.callClient.createCallAgent(credential,{displayName:data.appointment.display_name||"Learner"});const videoOptions=state.cameraOn&&state.localVideo?{localVideoStreams:[state.localVideo]}:undefined;state.call=state.callAgent.join({meetingLink:data.meeting_url},{audioOptions:{muted:!state.micOn},videoOptions});subscribeCall();$("prejoinState").hidden=true;$("meetingState").hidden=false;setMeetingState(state.call.state);}catch(e){showMessage(e.message||"Unable to join Live Training.");btn.disabled=false;btn.textContent="Enter Waiting Room";}}
function subscribeCall(){const call=state.call;call.on("stateChanged",()=>setMeetingState(call.state));call.on("remoteParticipantsUpdated",e=>{(e.added||[]).forEach(subscribeParticipant);(e.removed||[]).forEach(removeParticipant)});(call.remoteParticipants||[]).forEach(subscribeParticipant);}
function setMeetingState(s){$("meetingStatus").textContent=s==="InLobby"?"Waiting for instructor":s==="Connected"?"Connected":s==="Disconnected"?"Training ended":"Connecting…";$("meetingStatusDot").classList.toggle("connected",s==="Connected");$("lobbyPanel").hidden=s!=="InLobby";$("connectedPanel").hidden=s!=="Connected";const empty=$("emptyRemote");if(empty){empty.hidden=s==="Connected";empty.style.display=s==="Connected"?"none":"";}if(s==="Disconnected"){$("lobbyPanel").hidden=true;$("connectedPanel").hidden=true;showMessage("You have left the Live Training session.");}}
function subscribeParticipant(p){const key=participantKey(p);(p.videoStreams||[]).forEach(stream=>subscribeRemoteStream(key,p,stream));p.on?.("videoStreamsUpdated",e=>{(e.added||[]).forEach(stream=>subscribeRemoteStream(key,p,stream));(e.removed||[]).forEach(stream=>removeRemoteStream(key,stream));});}
async function subscribeRemoteStream(key,p,stream){const streamKey=`${key}:${stream.id}`;const handle=async()=>{if(!stream.isAvailable){removeRemoteStream(key,stream);return}if(state.remoteRenderers.has(streamKey))return;try{const renderer=new VideoStreamRenderer(stream),view=await renderer.createView({scalingMode:"Crop"});const tile=document.createElement("div");tile.className="remote-tile";tile.dataset.stream=streamKey;tile.appendChild(view.target);const label=document.createElement("span");label.className="remote-name";label.textContent=p.displayName||"Participant";tile.appendChild(label);$("remoteGallery").appendChild(tile);const empty=$("emptyRemote");if(empty){empty.hidden=true;empty.style.display="none";}state.remoteRenderers.set(streamKey,{renderer,tile});}catch(e){console.warn("Remote video renderer failed",e)}};stream.on?.("isAvailableChanged",handle);await handle();}
function removeRemoteStream(key,stream){const streamKey=`${key}:${stream.id}`,r=state.remoteRenderers.get(streamKey);if(r){try{r.renderer.dispose()}catch{}r.tile.remove();state.remoteRenderers.delete(streamKey)}if(!state.remoteRenderers.size&&state.call?.state!=="Connected"){const empty=$("emptyRemote");if(empty){empty.hidden=false;empty.style.display="";}}}
function removeParticipant(p){const prefix=`${participantKey(p)}:`;[...state.remoteRenderers.keys()].filter(k=>k.startsWith(prefix)).forEach(k=>{const r=state.remoteRenderers.get(k);try{r.renderer.dispose()}catch{}r.tile.remove();state.remoteRenderers.delete(k)});if(!state.remoteRenderers.size&&state.call?.state!=="Connected"){const empty=$("emptyRemote");if(empty){empty.hidden=false;empty.style.display="";}}}
function participantKey(p){return p.identifier?.communicationUserId||p.identifier?.microsoftTeamsUserId||p.identifier?.phoneNumber||p.displayName||Math.random().toString(36)}
async function toggleMeetingMic(){if(!state.call)return;try{if(state.call.isMuted){await state.call.unmute();$("meetingMicBtn").textContent="Mute"}else{await state.call.mute();$("meetingMicBtn").textContent="Unmute"}}catch(e){showMessage(e.message)}}
async function toggleMeetingCamera(){if(!state.call)return;try{if(state.localVideo&&state.call.localVideoStreams?.length){await state.call.stopVideo(state.localVideo);$("meetingCameraBtn").textContent="Start Camera"}else{if(!state.localVideo){const cams=await state.deviceManager.getCameras();if(!cams.length)throw new Error("No camera was found.");state.localVideo=new LocalVideoStream(cams[0]);}await state.call.startVideo(state.localVideo);$("meetingCameraBtn").textContent="Stop Camera"}}catch(e){showMessage(e.message)}}
async function leaveMeeting(){try{if(state.call)await state.call.hangUp()}catch{}finally{location.href="lms-my-appointments.html"}}
function showMessage(t){const el=$("liveMessage");el.textContent=t;el.hidden=false;}
function showError(t){showMessage(t);$("trainingTitle").textContent="Live Training unavailable";$("trainingSchedule").textContent="Please return to My Appointments or refresh this page.";}


/* SOURCE: assets/js/lms-global-support-bar.js?v=20260915-1 */
/* Screenings4u Learning Center — shared support bar
   Adds the same full-width support bar to every LMS page except the course player. */
(function () {
  'use strict';

  var page = (window.location.pathname.split('/').pop() || '').split('?')[0].split('#')[0].toLowerCase();
  if (page === 'lms-course-player.html') return;

  function installStyles() {
    if (document.getElementById('s4u-global-support-bar-styles')) return;
    var style = document.createElement('style');
    style.id = 's4u-global-support-bar-styles';
    style.textContent = `
      .s4u-global-support-bar{
        box-sizing:border-box;
        width:100%;
        grid-column:1 / -1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:24px;
        margin:22px 0 0;
        padding:20px 22px;
        border-radius:16px;
        background:#294f89;
        color:#fff;
        box-shadow:none;
      }
      .s4u-global-support-bar__copy{min-width:0}
      .s4u-global-support-bar__copy h2{
        margin:0 0 5px;
        color:#fff;
        font-size:17px;
        line-height:1.2;
        font-weight:800;
        letter-spacing:-.015em;
      }
      .s4u-global-support-bar__copy p{
        margin:0;
        color:rgba(255,255,255,.88);
        font-size:12px;
        line-height:1.5;
      }
      .s4u-global-support-bar__button{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        padding:0 20px;
        border-radius:10px;
        background:#ff6b00;
        color:#fff !important;
        font-size:12px;
        font-weight:800;
        text-decoration:none !important;
        white-space:nowrap;
        transition:background .15s ease,transform .15s ease;
      }
      .s4u-global-support-bar__button:hover{background:#e66000;transform:translateY(-1px)}
      .s4u-global-support-bar__button:focus-visible{outline:3px solid rgba(255,255,255,.45);outline-offset:3px}
      @media (max-width:700px){
        .s4u-global-support-bar{align-items:flex-start;flex-direction:column;padding:18px;margin-top:18px}
        .s4u-global-support-bar__button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function removePageSpecificSupportBars() {
    document.querySelectorAll('.orders-support-card').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.danger-card').forEach(function (el) {
      var text = (el.textContent || '').toLowerCase();
      if (text.includes('contact support') || text.includes('need help with your account')) el.remove();
    });
  }

  function getTarget() {
    return document.querySelector('.lms-content') ||
      document.querySelector('.lms-support-content') ||
      document.querySelector('.lms-notifications-content') ||
      document.querySelector('.onboard-wrap') ||
      document.querySelector('.lms-main');
  }

  function inject() {
    if (document.querySelector('.s4u-global-support-bar')) return;
    var target = getTarget();
    if (!target) return;

    installStyles();
    removePageSpecificSupportBars();

    var bar = document.createElement('section');
    bar.className = 's4u-global-support-bar';
    bar.setAttribute('aria-label', 'Training support');
    bar.innerHTML = `
      <div class="s4u-global-support-bar__copy">
        <h2>Need help with your training?</h2>
        <p>Contact Screenings4u support for course access, certificates, appointments, account questions, or training assistance.</p>
      </div>
      <a class="s4u-global-support-bar__button" href="lms-support.html">Contact Support</a>
    `;
    target.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
