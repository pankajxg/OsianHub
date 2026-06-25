;(function(){
  var w = window;
  var host = location.hostname || '';
  var isFile = (location.protocol === 'file:');
  var isLocal = isFile || (host === '' || host === 'localhost' || host === '127.0.0.1');
  var override = w.API_BASE_URL || (function(){ try { return localStorage.getItem('API_BASE_URL') || ''; } catch(_) { return ''; } })();
  try {
    var qs = new URLSearchParams(location.search||'');
    var sel = (qs.get('backend')||'').toLowerCase();
    if (sel === 'prod') {
      override = 'https://osianhub.onrender.com/api';
      try { localStorage.setItem('API_BASE_URL', override); } catch(_) {}
    } else if (sel === 'local') {
      override = 'http://localhost:5000/api';
      try { localStorage.setItem('API_BASE_URL', override); } catch(_) {}
    }
  } catch(_){}

  var base = override || (isLocal ? 'http://localhost:5000/api' : 'https://osianhub.onrender.com/api');
  w.API_BASE = base;

  function getToken(){ try { return localStorage.getItem('token') || ''; } catch(_) { return ''; } }
  w.getToken = getToken;

    if (!window.API_BASE) {
        const hostname = window.location.hostname || '';
        const isFile = window.location.protocol === 'file:';
        if (isFile || hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1') {
            window.API_BASE = 'http://localhost:5000/api';
        } else {
            window.API_BASE = 'https://osianhub.onrender.com/api';
        }
        console.log('API Base URL set to:', window.API_BASE);
    }

    async function apiFetch(path, opts){
    var rel = path.startsWith('/') ? path : ('/'+path);
    // Ensure API_BASE is used; if empty, use fallback
    var base = w.API_BASE || (function() {
        const h = window.location.hostname;
        const p = window.location.port;
        // If we are on the frontend ports (5500, 5501, 3000, etc) and localhost, point to backend 5000
        if ((h === 'localhost' || h === '127.0.0.1') && (p === '5500' || p === '5501' || p === '3000' || p === '8080' || p === '')) {
            return 'http://localhost:5000/api';
        }
        return (h === 'localhost' || h === '127.0.0.1') ? 'http://localhost:5000/api' : 'https://osianhub.onrender.com/api';
    })();
    var prim = base + rel;
    var o = Object.assign({ credentials: 'omit' }, opts||{});
    o.headers = Object.assign({}, o.headers||{});
    // If body is FormData, do NOT set Content-Type (browser handles it)
    if (!('Content-Type' in o.headers) && o.body && !(o.body instanceof FormData)) {
      o.headers['Content-Type'] = 'application/json';
    }
    var t = getToken();
    // Don't send token for auth endpoints to avoid issues with stale/invalid tokens
    var isAuthEndpoint = rel.includes('/auth/login') || rel.includes('/auth/register') || rel.includes('/auth/verify-otp') || rel.includes('/auth/resend-otp');
    if (t && !isAuthEndpoint && !('Authorization' in o.headers)) o.headers['Authorization'] = 'Bearer ' + t;

    async function handleResponse(res){
      var ct = (res.headers.get('content-type')||'');
      var isJson = ct.includes('application/json');
      var body = null;
      try { body = isJson ? await res.json() : await res.text(); } catch(_) {}
      if (res.ok) return body;
      if (res.status === 401){
        if (o.noRedirect) {
             throw new Error((body && body.message) ? body.message : 'Unauthorized');
        }
        if (window.isLoggingOut) return; // Prevent multiple redirects
        window.isLoggingOut = true;
        try { 
            localStorage.removeItem('token'); 
            localStorage.removeItem('user'); 
            sessionStorage.setItem('justLoggedOut', 'true');
        } catch(_){ }
        var path = (location.pathname||'').toLowerCase();
        var isPublic = (path.endsWith('login.html') || path.endsWith('register.html') || path.endsWith('index.html') || path.endsWith('forgot-password.html') || path === '/' );
        if (!isPublic) {
           if (path.includes('/auth/')) location.href = 'login.html';
           else if (path.includes('/admin/') || path.includes('/user/') || path.includes('/super-admin/')) location.href = '../auth/login.html';
           else location.href = 'frontend/auth/login.html';
        }
        throw new Error((body && body.message) ? body.message : 'Unauthorized');
      }
      if (res.status === 403){
        var err = new Error((body && body.message) ? body.message : 'Forbidden');
        if (body && body.redirect) err.redirect = body.redirect;
        if (body && body.email) err.email = body.email;
        throw err;
      }
      if (res.status >= 500){
        throw new Error((body && body.message) ? body.message : ('Server error '+res.status));
      }
      throw new Error((body && body.message) ? body.message : ('HTTP '+res.status));
    }

    async function tryOne(url){
      var res;
      try {
        res = await fetch(url, o);
      } catch (e) {
        var online = (typeof navigator !== 'undefined' && 'onLine' in navigator) ? !!navigator.onLine : true;
        var baseUrl = w.API_BASE || '';
        var isLocalApi = (baseUrl.indexOf('localhost') !== -1 || baseUrl.indexOf('127.0.0.1') !== -1);
        var msg = '';
        if (!online) {
          msg = 'No internet connection';
        } else if (isLocalApi) {
          msg = 'Cannot reach local API at ' + baseUrl + '. Please start the backend.';
        } else {
          msg = 'Cannot reach server ' + baseUrl + '. Please try again later.';
        }
        throw new Error(msg);
      }
      return handleResponse(res);
    }

    return await tryOne(prim);
  }
  w.apiFetch = apiFetch;

  var userProfileCache = null;
  var userProfileCacheTime = 0;
  var userProfilePromise = null;

  function getUserProfile(options){
    options = options || {};
    var force = !!options.forceRefresh;
    var maxAge = options.maxAgeMs || (5*60*1000);
    var now = Date.now();
    if (!force && userProfileCache && userProfileCacheTime && (now - userProfileCacheTime) < maxAge) {
      return Promise.resolve(userProfileCache);
    }
    if (!force && !userProfileCache){
      try {
        var raw = localStorage.getItem('user');
        if (raw){
          var stored = JSON.parse(raw);
          if (stored && (stored.role || stored._id)){
            userProfileCache = stored;
            userProfileCacheTime = now;
            return Promise.resolve(stored);
          }
        }
      } catch(_) {}
    }
    if (!force && userProfilePromise) {
      return userProfilePromise;
    }
    userProfilePromise = (async function(){
      var data = await apiFetch('/users/profile', { silent: !!options.silent });
      var u = data && data.user ? data.user : null;
      if (u){
        userProfileCache = u;
        userProfileCacheTime = Date.now();
        try { localStorage.setItem('user', JSON.stringify(u)); } catch(_) {}
      }
      userProfilePromise = null;
      return u;
    })();
    return userProfilePromise;
  }
  w.getUserProfile = getUserProfile;

  function applyTheme(){
    document.body.setAttribute('data-theme', 'dark');
    var tag = document.getElementById('theme-vars');
    if (tag) tag.remove();
    try { localStorage.setItem('theme', 'dark'); } catch(_) {}
  }
  w.applyTheme = applyTheme;
  w.setTheme = function(){ applyTheme(); };

  function setImg(id, src){ var el = document.getElementById(id); if (el && src) el.src = src; }
  function setImgByClass(cls, src){ var els = document.getElementsByClassName(cls); for (var i=0;i<els.length;i++){ var e=els[i]; if (e && src) e.src = src; } }

  async function initAvatars(){
    var avatar = null;
    var user = null;
    try {
      var stored = JSON.parse(localStorage.getItem('osianUserData')||'{}');
      avatar = stored.avatar || null;
    } catch(_) {}
    if (!avatar){
      try {
        user = JSON.parse(localStorage.getItem('user')||'{}');
        var prof = user && user.profile ? user.profile : {};
        avatar = prof.avatar || user.avatar || null;
      } catch(_) {}
    } else {
      try {
        user = JSON.parse(localStorage.getItem('user')||'{}');
      } catch(_) {}
    }
    avatar = avatar || 'https://i.ibb.co/jP9JWBBy/diljj.png';
    setImg('topAvatar', avatar);
    setImg('heroAvatar', avatar);
    setImg('userAvatar', avatar);
    setImg('headerAvatar', avatar);
    setImg('avatar', avatar);
    setImgByClass('user-avatar', avatar);

    // Don't fetch profile on public pages to avoid 401 loops if token is invalid
    var path = (location.pathname||'').toLowerCase();
    var isPublic = (path.endsWith('login.html') || path.endsWith('register.html') || path.endsWith('index.html') || path === '/' || path.includes('/auth/'));
    if (isPublic) return;

    try {
      var tkn = getToken();
      if (!tkn) throw new Error('no-token');

      var lastFetch = 0;
      try { lastFetch = parseInt(localStorage.getItem('osianAvatarLastFetch')||'0',10)||0; } catch(_) {}
      var nowTs = Date.now();
      var tenMinutes = 10 * 60 * 1000;
      if (lastFetch && (nowTs - lastFetch) < tenMinutes && avatar && avatar !== 'https://i.ibb.co/jP9JWBBy/diljj.png') {
        return;
      }

      var u = await getUserProfile({ maxAgeMs: tenMinutes, silent: true });
      if (u){
        var p=u.profile||{}; var fresh = p.avatar || u.avatar || null;
        if (fresh && fresh !== avatar){
          setImg('topAvatar', fresh);
          setImg('heroAvatar', fresh);
          setImg('userAvatar', fresh);
          setImg('headerAvatar', fresh);
          setImg('avatar', fresh);
          setImgByClass('user-avatar', fresh);
          try {
            var raw = localStorage.getItem('osianUserData');
            var obj = raw ? JSON.parse(raw) : {};
            obj.avatar = fresh;
            localStorage.setItem('osianUserData', JSON.stringify(obj));
          } catch(_) {}
        }
        try {
          var userRaw = localStorage.getItem('user');
          var userObj = userRaw ? JSON.parse(userRaw) : {};
          userObj.profile = userObj.profile || {};
          if (fresh) userObj.profile.avatar = fresh;
          localStorage.setItem('user', JSON.stringify(userObj));
        } catch(_) {}
        try { localStorage.setItem('osianAvatarLastFetch', String(nowTs)); } catch(_) {}
      }
    } catch (_) {}
  }
  w.initAvatars = initAvatars;

  function getRedirectUrl(targetPath) {
    if (!targetPath) return targetPath;
    if (targetPath.startsWith('/')) {
      var pathname = window.location.pathname;
      var match = pathname.match(/^\/[^/]+/);
      var firstSegment = match ? match[0] : '';
      if (firstSegment.toLowerCase() === '/osianhub') {
        if (targetPath.startsWith('/frontend')) {
          return firstSegment + targetPath.substring(9);
        }
        return firstSegment + targetPath;
      }
    }
    return targetPath;
  }
  w.getRedirectUrl = getRedirectUrl;

  function logout() {
    console.log('[Auth] Logging out via shared-init...');
    var keys = ['token', 'user', 'authToken', 'userData', 'userPreferences', 'quizProgress'];
    for (var i = 0; i < keys.length; i++) {
      try { localStorage.removeItem(keys[i]); } catch(_) {}
    }
    try {
      document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    } catch(_) {}
    if (window.authRedirectInProgress) {
      delete window.authRedirectInProgress;
    }
    window.location.href = getRedirectUrl('/frontend/auth/login.html');
  }
  w.logout = logout;


  function init(){
    applyTheme();
    initAvatars();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
/* File: /frontend/shared/js/sidebar-loader.js (or append to shared-init.js) */

document.addEventListener("DOMContentLoaded", async function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return; // Stop if no sidebar container exists on page

    try {
        // 1. Fetch the consistent HTML file
        // Adjust path if your components folder is different relative to the HTML file
        const response = await fetch(window.getRedirectUrl ? window.getRedirectUrl('/frontend/components/sidebar-user.html') : '/frontend/components/sidebar-user.html'); 
        if (!response.ok) throw new Error("Sidebar file not found");
        
        const html = await response.text();
        container.innerHTML = html;

        // 2. Highlight the Current Page
        const currentPath = window.location.pathname;
        const links = container.querySelectorAll('.sidebar-menu a');
        
        links.forEach(link => {
            // Remove any hardcoded active classes from the HTML file
            link.classList.remove('active');
            
            // Get the href (e.g., "events.html")
            const href = link.getAttribute('href');
            
            // Check if current URL contains the href
            if (currentPath.includes(href) && href !== '#') {
                link.classList.add('active');
            }
        });

        // 3. Load User Data (Name/Image)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const nameEl = document.getElementById('sidebar-name');
        const imgEl = document.getElementById('sidebar-avatar');

        if(nameEl && user.name) nameEl.textContent = user.name;
        if(imgEl && (user.avatar || user.profile?.avatar)) {
             imgEl.src = user.avatar || user.profile.avatar;
        }

    } catch (error) {
        console.error("Error loading sidebar:", error);
        container.innerHTML = "<p style='color:white; padding:20px;'>Error loading menu.</p>";
    }
});
