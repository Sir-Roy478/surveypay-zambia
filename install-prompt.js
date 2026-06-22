// install-prompt.js
// Shared across all pages. Handles:
// 1. Full-screen popup for first-time visitors
// 2. Persistent slide-up banner for return visitors
// 3. iPhone-specific manual install instructions
// 4. Firestore logging of install events

(function () {
  var deferredInstallPrompt = null;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;

  // Never show anything if already running as installed app
  if (isStandalone) {
    logInstallEvent('standalone_session_once_per_session');
    return;
  }

  // ── Inject CSS ──
  var style = document.createElement('style');
  style.textContent = `
    #installOverlay {
      position: fixed; inset: 0; background: rgba(10,5,30,0.92);
      backdrop-filter: blur(6px); z-index: 9998;
      display: none; align-items: center; justify-content: center; padding: 20px;
    }
    #installOverlay.show { display: flex; }
    .install-modal {
      background: #231545; border: 1px solid rgba(180,120,255,0.25);
      border-radius: 22px; padding: 32px 24px; max-width: 380px; width: 100%;
      text-align: center; box-shadow: 0 0 60px rgba(255,122,32,0.25);
      animation: installPopIn .35s ease;
    }
    @keyframes installPopIn { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
    .install-modal-icon {
      width: 72px; height: 72px; border-radius: 18px; margin: 0 auto 16px;
      background: linear-gradient(135deg,#ff7a20,#e05500);
      display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
    }
    .install-modal h2 {
      font-family: 'Sora', sans-serif; color: #fff; font-size: 1.3rem; font-weight: 800; margin-bottom: 8px;
    }
    .install-modal p {
      color: #c4a8ff; font-size: .9rem; line-height: 1.6; margin-bottom: 20px;
    }
    .install-modal-btn {
      width: 100%; padding: 14px; border-radius: 50px; background: #ff7a20; color: #000;
      font-family: 'Sora', sans-serif; font-weight: 700; font-size: .95rem; border: none;
      cursor: pointer; margin-bottom: 10px; box-shadow: 0 0 25px rgba(255,122,32,0.4);
    }
    .install-modal-btn:hover { background: #e05500; }
    .install-modal-skip {
      background: none; border: none; color: #8b7aa8; font-size: .82rem; cursor: pointer; text-decoration: underline;
    }
    .install-ios-steps {
      text-align: left; background: rgba(255,255,255,0.05); border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px; font-size: .85rem; color: #e8ddff; line-height: 1.7;
    }
    .install-ios-steps b { color: #ff7a20; }

    #installBanner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9997;
      background: #231545; border-top: 1px solid rgba(255,122,32,0.3);
      padding: 14px 16px; display: none; align-items: center; gap: 12px;
      box-shadow: 0 -8px 30px rgba(0,0,0,0.4);
    }
    #installBanner.show { display: flex; animation: slideUpBanner .4s ease; }
    @keyframes slideUpBanner { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .install-banner-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg,#ff7a20,#e05500);
      display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
    }
    .install-banner-text { flex: 1; min-width: 0; }
    .install-banner-text strong { color: #fff; font-size: .85rem; display: block; }
    .install-banner-text span { color: #c4a8ff; font-size: .75rem; }
    .install-banner-btn {
      background: #ff7a20; color: #000; border: none; padding: 8px 16px; border-radius: 50px;
      font-weight: 700; font-size: .8rem; cursor: pointer; white-space: nowrap; flex-shrink: 0;
    }
    .install-banner-close {
      background: none; border: none; color: #8b7aa8; font-size: 1.1rem; cursor: pointer; padding: 4px; flex-shrink: 0;
    }
    @media(min-width: 600px) {
      #installBanner { left: auto; right: 20px; bottom: 20px; max-width: 380px; border-radius: 16px; border: 1px solid rgba(255,122,32,0.3); }
    }
  `;
  document.head.appendChild(style);

  // ── Inject full-screen popup HTML ──
  var overlay = document.createElement('div');
  overlay.id = 'installOverlay';
  overlay.innerHTML = isIOS
    ? `<div class="install-modal">
        <div class="install-modal-icon">📲</div>
        <h2>Install SurveyPay</h2>
        <p>Add SurveyPay to your home screen for faster access and a smoother experience — no app store needed.</p>
        <div class="install-ios-steps">
          1. Tap the <b>Share icon</b> 􀈂 at the bottom of Safari<br/>
          2. Scroll down and tap <b>"Add to Home Screen"</b><br/>
          3. Tap <b>"Add"</b> in the top right corner
        </div>
        <button class="install-modal-btn" onclick="window.__closeInstallOverlay()">Got it!</button>
      </div>`
    : `<div class="install-modal">
        <div class="install-modal-icon">📲</div>
        <h2>Install SurveyPay</h2>
        <p>Get the app on your home screen for faster access, offline support, and a smoother experience — completely free.</p>
        <button class="install-modal-btn" id="overlayInstallBtn">⬇️ Install Now</button>
        <button class="install-modal-skip" onclick="window.__closeInstallOverlay()">Maybe later</button>
      </div>`;
  document.body.appendChild(overlay);

  // ── Inject slide-up banner HTML ──
  var banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.innerHTML = `
    <div class="install-banner-icon">📲</div>
    <div class="install-banner-text">
      <strong>Install SurveyPay</strong>
      <span>${isIOS ? 'Add to your home screen' : 'Get the app for quick access'}</span>
    </div>
    <button class="install-banner-btn" id="bannerInstallBtn">Install</button>
    <button class="install-banner-close" onclick="window.__closeInstallBanner()">✕</button>
  `;
  document.body.appendChild(banner);

  // ── Logic ──
  var hasSeenPopup = localStorage.getItem('sp_install_popup_seen');
  var bannerDismissedAt = parseInt(localStorage.getItem('sp_install_banner_dismissed') || '0', 10);
  var now = Date.now();
  var oneDayMs = 24 * 60 * 60 * 1000;

  function showOverlay() {
    document.getElementById('installOverlay').classList.add('show');
    logInstallEvent('popup_shown');
  }
  function showBanner() {
    document.getElementById('installBanner').classList.add('show');
  }

  window.__closeInstallOverlay = function () {
    document.getElementById('installOverlay').classList.remove('show');
    localStorage.setItem('sp_install_popup_seen', '1');
    // After closing popup, show the persistent banner instead
    setTimeout(showBanner, 400);
  };

  window.__closeInstallBanner = function () {
    document.getElementById('installBanner').classList.remove('show');
    localStorage.setItem('sp_install_banner_dismissed', String(Date.now()));
  };

  // First-time visitor → full popup after a short delay
  if (!hasSeenPopup) {
    setTimeout(showOverlay, 2500);
  } else {
    // Return visitor who hasn't installed → show banner if not dismissed in last 24h
    var dismissedRecently = bannerDismissedAt && (now - bannerDismissedAt < oneDayMs);
    if (!dismissedRecently) {
      setTimeout(showBanner, 1500);
    }
  }

  // ── Android/Chrome native prompt capture ──
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  function triggerNativeInstall(sourceLabel) {
    if (!deferredInstallPrompt) {
      // No native prompt available (already installed, unsupported browser, or iOS)
      if (isIOS) return; // iOS already shows manual steps in the overlay
      alert('Your browser doesn\'t support one-tap install here. Try opening this site in Chrome, or use your browser menu → "Add to Home Screen" / "Install App".');
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function (choice) {
      logInstallEvent(choice.outcome === 'accepted' ? 'prompt_accepted' : 'prompt_dismissed', sourceLabel);
      deferredInstallPrompt = null;
      document.getElementById('installOverlay').classList.remove('show');
      document.getElementById('installBanner').classList.remove('show');
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'overlayInstallBtn') triggerNativeInstall('popup');
    if (e.target && e.target.id === 'bannerInstallBtn') triggerNativeInstall('banner');
  });

  window.addEventListener('appinstalled', function () {
    logInstallEvent('installed');
    document.getElementById('installOverlay').classList.remove('show');
    document.getElementById('installBanner').classList.remove('show');
    localStorage.setItem('sp_install_popup_seen', '1');
  });

  // ── Firestore logging (best-effort, fails silently if db isn't ready) ──
  function logInstallEvent(eventType, source) {
    try {
      if (typeof db !== 'undefined') {
        db.collection('installEvents').add({
          event: eventType,
          source: source || 'unknown',
          isIOS: isIOS,
          platform: navigator.userAgent,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) { /* silent */ }
  }
})();
