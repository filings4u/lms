(() => {
  "use strict";

  const CACHE_PREFIX = "s4u:lms:view:";
  const CACHE_TTL = 10 * 60 * 1000;
  const DEFAULT_STORAGE_KEY = "s4u-training-auth-session";
  const clientCache = new Map();
  const prefetched = new Set();

  function readStoredSession(storageKey = DEFAULT_STORAGE_KEY) {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed?.session || parsed;
      if (!session?.access_token || !session?.user?.id) return null;
      const expiresAt = Number(session.expires_at || 0);
      if (expiresAt && expiresAt * 1000 < Date.now() + 30000) return null;
      return session;
    } catch (_) {
      return null;
    }
  }

  function patchSupabaseFactory() {
    const supabase = window.supabase;
    if (!supabase?.createClient || supabase.__s4uFastPatched) return;
    const originalCreateClient = supabase.createClient.bind(supabase);

    supabase.createClient = function(url, key, options = {}) {
      const storageKey = options?.auth?.storageKey || DEFAULT_STORAGE_KEY;
      const cacheKey = `${url}|${storageKey}`;
      if (clientCache.has(cacheKey)) return clientCache.get(cacheKey);

      const client = originalCreateClient(url, key, options);
      const originalGetSession = client.auth.getSession.bind(client.auth);
      const originalSignOut = client.auth.signOut.bind(client.auth);

      client.auth.getSession = function() {
        const stored = readStoredSession(storageKey);
        if (stored) {
          Promise.resolve().then(() => originalGetSession()).catch(() => {});
          return Promise.resolve({ data: { session: stored }, error: null });
        }
        return originalGetSession();
      };

      client.auth.signOut = async function(...args) {
        try {
          for (const k of Object.keys(sessionStorage)) {
            if (k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
          }
        } catch (_) {}
        return originalSignOut(...args);
      };

      clientCache.set(cacheKey, client);
      window.screenings4uSupabase ||= client;
      window.supabaseClient ||= client;
      return client;
    };

    supabase.__s4uFastPatched = true;
  }

  function pageCacheKey() {
    return CACHE_PREFIX + location.pathname + location.search;
  }

  function loadCachedView() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(pageCacheKey()) || "null");
      if (!saved?.html || Date.now() - Number(saved.savedAt || 0) > CACHE_TTL) return null;
      return saved.html;
    } catch (_) {
      return null;
    }
  }

  function isCacheablePage() {
    const page = document.body?.dataset?.portalPage || "";
    return new Set([
      "dashboard","my-courses","courses","progress","certificates",
      "my-appointments","group-seats","documents","orders",
      "notifications","account","support","live-training"
    ]).has(page);
  }

  function wireViewCache() {
    if (!isCacheablePage()) return;
    const cached = loadCachedView();
    let observedContent = null;
    let contentObserver = null;

    function bindContent(content) {
      if (!content || content === observedContent) return;
      observedContent = content;
      contentObserver?.disconnect();

      const current = (content.innerHTML || "").trim();
      if (cached && (!current || /loading|please wait/i.test(content.textContent || ""))) {
        content.innerHTML = cached;
        content.dataset.fastCacheRestored = "true";
      }

      let timer = 0;
      contentObserver = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const html = (content.innerHTML || "").trim();
          const text = (content.textContent || "").trim();
          if (html.length > 80 && !/loading|please wait|unable to load/i.test(text)) {
            try {
              sessionStorage.setItem(pageCacheKey(), JSON.stringify({ html, savedAt: Date.now() }));
            } catch (_) {}
          }
        }, 120);
      });
      contentObserver.observe(content, { childList: true, subtree: true, characterData: true });
    }

    bindContent(document.getElementById("content"));
    const app = document.getElementById("trainingPortalApp");
    if (app) {
      new MutationObserver(() => bindContent(document.getElementById("content")))
        .observe(app, { childList: true, subtree: true });
    }
  }

  async function prefetchPage(href) {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || !/\.html(?:$|\?)/i.test(url.pathname + url.search)) return;
      if (prefetched.has(url.href)) return;
      prefetched.add(url.href);

      const response = await fetch(url.href, { credentials: "same-origin", cache: "force-cache" });
      if (!response.ok) return;
      const text = await response.text();

      const assets = [...text.matchAll(/(?:src|href)=["']([^"']+\.(?:css|js)(?:\?[^"']*)?)["']/gi)]
        .map(m => {
          try { return new URL(m[1], url.href); } catch (_) { return null; }
        })
        .filter(Boolean)
        .filter(u => u.origin === location.origin);

      assets.slice(0, 8).forEach(u => {
        fetch(u.href, { credentials: "same-origin", cache: "force-cache" }).catch(() => {});
      });
    } catch (_) {}
  }

  function wirePrefetch() {
    const trigger = event => {
      const a = event.target?.closest?.("a[href]");
      if (a) prefetchPage(a.href);
    };
    document.addEventListener("pointerover", trigger, { passive: true });
    document.addEventListener("focusin", trigger);
    document.addEventListener("touchstart", trigger, { passive: true });

    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 800));
    idle(() => {
      [
        "lms-dashboard.html","lms-my-courses.html","lms-courses.html",
        "lms-progress.html","lms-certificates.html","lms-my-appointments.html"
      ].forEach(prefetchPage);
    });
  }

  function boot() {
    patchSupabaseFactory();
    wireViewCache();
    wirePrefetch();
    document.documentElement.classList.add("lms-fast-ready");
  }

  if (window.supabase?.createClient) boot();
  else {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (window.supabase?.createClient) {
        clearInterval(timer);
        boot();
      } else if (attempts > 80) {
        clearInterval(timer);
        wireViewCache();
        wirePrefetch();
      }
    }, 10);
  }
})();