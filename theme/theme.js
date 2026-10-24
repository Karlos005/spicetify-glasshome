// GlassHome — behaviour for the "Spotify Home" design:
// cover-tinted backdrop, the Home "now playing" hero and a lite mode.
//
// Spotify 1.3.x ships obfuscated layout class names that Spicetify doesn't always map,
// so the shell is found through its CSS grid areas and stable data-testids, and tagged
// with dex-* classes that user.css styles.
(function glassHome() {
  if (!(window.Spicetify && Spicetify.Player && Spicetify.Platform && Spicetify.Platform.History && document.querySelector(".main-view-container, [data-testid='now-playing-bar']"))) {
    setTimeout(glassHome, 300);
    return;
  }

  const History = Spicetify.Platform.History;
  const FALLBACK = { c1: "#c9873a", c2: "#6b3a1d" };
  const AREAS = { "global-nav": "dex-globalnav", "left-sidebar": "dex-nav", "main-view": "dex-main", "right-sidebar": "dex-right", "now-playing-bar": "dex-player" };
  const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M3 1.7v12.6a.7.7 0 0 0 1.05.6l10.6-6.3a.7.7 0 0 0 0-1.2L4.05 1.1A.7.7 0 0 0 3 1.7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z"/></svg>';

  let colorToken = 0;

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const path = () => (History.location && History.location.pathname) || "/";
  const uriToPath = uri => {
    const p = String(uri || "").split(":");
    return p.length >= 3 ? `/${p[1]}/${p[2]}` : null;
  };
  const tag = (node, cls) => node && !node.classList.contains(cls) && node.classList.add(cls);

  // ---------- shell tagging ----------
  let shell = null;
  let lastSweep = 0;

  function findShell() {
    let n = document.querySelector(".main-view-container") || document.querySelector("[data-testid='now-playing-bar']");
    while (n && n !== document.body) {
      const p = n.parentElement;
      if (p && /main-view/.test(getComputedStyle(p).gridTemplateAreas || "")) return p;
      n = p;
    }
    return null;
  }

  function tagShell() {
    if (!shell || !shell.isConnected) shell = findShell();
    if (!shell) return;
    tag(shell, "dex-shell");
    for (let a = shell.parentElement; a && a !== document.documentElement; a = a.parentElement) tag(a, "dex-clear");
    for (const child of shell.children) {
      const cs = getComputedStyle(child);
      const area = [cs.gridRowStart, cs.gridColumnStart, cs.gridRowEnd, cs.gridColumnEnd].map(s => (s || "").trim()).find(s => AREAS[s]);
      const cls = AREAS[area];
      if (!cls) continue;
      // The left-sidebar area also holds a resize/placeholder strip; only tag the real library.
      if (cls === "dex-nav" && !child.querySelector("#Desktop_LeftSidebar_Id, nav")) continue;
      tag(child, cls);
    }

    for (const sel of [".dex-main", ".dex-nav", ".dex-right"]) {
      const box = shell.querySelector(sel);
      const vp = box && box.querySelector("[data-overlayscrollbars-viewport], .os-viewport");
      if (vp) tag(vp, "dex-vp"); // first match in document order = the outermost viewport
    }

    // A Canvas <video> is shown through a video overlay that ignores CSS effects on the element itself,
    // so its fade is applied to a container (the video's third ancestor).
    const cv = shell.querySelector(".dex-right video");
    const cbox = cv && cv.parentElement && cv.parentElement.parentElement && cv.parentElement.parentElement.parentElement;
    if (cbox && !cbox.classList.contains("dex-canvas")) {
      for (const old of shell.querySelectorAll(".dex-canvas")) old.classList.remove("dex-canvas");
      cbox.classList.add("dex-canvas");
    }

    const nav = shell.querySelector(".dex-globalnav");
    if (nav) {
      const input = nav.querySelector(".dex-search") ? null : nav.querySelector("[data-testid='search-input'], input");
      if (input) {
        let box = input.parentElement;
        for (let i = 0; box && box !== nav && i < 6; i++, box = box.parentElement) {
          const bgc = getComputedStyle(box).backgroundColor;
          if (bgc && bgc !== "transparent" && !/rgba\(0, 0, 0, 0\)/.test(bgc)) {
            tag(box, "dex-search");
            break;
          }
        }
      }
    }

    // Spotify paints page colours (home header, playlist header, action bar) with
    // absolutely positioned, text-less layers carrying an inline background; drop them
    // so the tinted backdrop shows through.
    const main = shell.querySelector(".dex-main");
    const now = performance.now();
    // The colour-layer sweep walks every styled node, so it runs at most every 2.5 s.
    if (main && now - lastSweep > 2500) {
      lastSweep = now;
      const minW = main.clientWidth * 0.5;
      main.querySelectorAll('[style*="background"]').forEach(n => {
        if (n.classList.contains("dex-nobg") || n.classList.contains("dex-topbar") || n.closest(".dex-hero")) return;
        // Real pictures (an artist's header photo) are kept; only flat colour and gradient layers go.
        if (/url\(["']?https?:/.test(n.getAttribute("style") || "")) return;
        const ncs = getComputedStyle(n);
        if (/url\(["']?https?:/.test(ncs.backgroundImage || "")) return; // remote picture (artist photo): keep
        const pos = ncs.position;
        if (pos === "sticky") {
          tag(n, "dex-topbar");
          return;
        }
        if (n.childElementCount || n.textContent) return;
        if ((pos === "absolute" || pos === "fixed" || pos === "sticky") && n.clientWidth >= minW) {
          // A short strip is the sticky top bar fading in on scroll; it keeps a glass fill so text stays readable.
          tag(n, n.clientHeight && n.clientHeight < 120 ? "dex-topbar" : "dex-nobg");
        }
      });
    }
  }

  // ---------- background ----------
  // Like spicetify-dynamic-theme: the cover itself, heavily blurred, is the backdrop.
  const bg = el("div", null, '<div class="dex-base"></div><div class="dex-art dex-art--a"></div><div class="dex-art dex-art--b"></div><div class="dex-sheen"></div>');
  bg.id = "dex-bg";
  document.body.prepend(bg);
  const arts = [bg.querySelector(".dex-art--a"), bg.querySelector(".dex-art--b")];
  let artIdx = 0;

  function setColors(c1, c2, menu, menuHover) {
    const st = document.documentElement.style;
    st.setProperty("--dex-c1", c1);
    st.setProperty("--dex-c2", c2);
    // Opaque, cover-tinted surfaces for menus and dialogs (they must never be see-through).
    if (menu) st.setProperty("--dex-menu", menu);
    else st.removeProperty("--dex-menu");
    if (menuHover) st.setProperty("--dex-menu-hl", menuHover);
    else st.removeProperty("--dex-menu-hl");
  }

  // Spotify 1.3.4+ may drop Player.data; PlayerAPI._state.item carries the same shape.
  function playbackItem() {
    try {
      return (Spicetify.Player.data && Spicetify.Player.data.item) || (Spicetify.Platform.PlayerAPI && Spicetify.Platform.PlayerAPI._state && Spicetify.Platform.PlayerAPI._state.item) || null;
    } catch (e) {
      return null;
    }
  }

  function coverUrl(item) {
    const m = (item && item.metadata) || {};
    const raw = m.image_xlarge_url || m.image_large_url || m.image_url || (item && item.images && item.images[0] && item.images[0].url) || "";
    if (raw.startsWith("spotify:image:")) return "https://i.scdn.co/image/" + raw.slice(14);
    return raw;
  }

  // Colour from the (already downscaled) canvas, weighted by saturation so a colourful
  // cover beats a grey background.
  function sampleColors(ctx, size) {
    const d = ctx.getImageData(0, 0, size, size).data;
    let r = 0, gr = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const wt = 0.15 + (mx - mn) / 255;
      r += d[i] * wt; gr += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
    }
    r /= w; gr /= w; b /= w;
    const lift = k => `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(gr * k))},${Math.min(255, Math.round(b * k))})`;
    return { c1: lift(1.25), c2: lift(0.45), menu: lift(0.3), menuHover: lift(0.46) };
  }

  const coverCache = new Map();
  let coverShown = "";
  let coverLoading = "";

  function applyCover(du, colors, url) {
    coverShown = url;
    setColors(colors.c1, colors.c2, colors.menu, colors.menuHover);
    const next = arts[1 - artIdx];
    next.style.backgroundImage = `url("${du}")`;
    next.classList.add("is-on");
    arts[artIdx].classList.remove("is-on");
    artIdx = 1 - artIdx;
  }

  // Remote https:// covers don't paint as CSS backgrounds in Spotify's build (dynamic-theme
  // documents this), so the cover goes through an anonymous-CORS canvas and is used as a data: URL.
  function updateColors(retries = 0) {
    const token = ++colorToken;
    const item = playbackItem();
    const url = coverUrl(item);
    if (!url) {
      // Right after a restart the player has no state yet; keep asking until it does.
      if (retries < 100) setTimeout(() => { if (token === colorToken) updateColors(retries + 1); }, retries < 10 ? 300 : 1500);
      else setColors(FALLBACK.c1, FALLBACK.c2);
      return;
    }
    coverLoading = url;
    if (coverCache.has(url)) {
      const hit = coverCache.get(url);
      applyCover(hit.du, hit.colors, url);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (token !== colorToken) return;
      try {
        const S = 96;
        const cv = document.createElement("canvas");
        cv.width = cv.height = S;
        const cx = cv.getContext("2d", { willReadFrequently: true });
        const sc = Math.max(S / img.naturalWidth, S / img.naturalHeight);
        const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
        cx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
        const colors = sampleColors(cx, S);
        // Pre-blurred 64px backdrop: the browser's bilinear upscaling does the rest, so CSS needs no blur filter.
        const bk = document.createElement("canvas");
        bk.width = bk.height = 64;
        const bx = bk.getContext("2d");
        bx.filter = "blur(3px) saturate(1.7) brightness(0.8)";
        bx.drawImage(cv, -6, -6, 76, 76);
        const hit = { du: bk.toDataURL("image/jpeg", 0.8), colors };
        if (coverCache.size >= 20) coverCache.delete(coverCache.keys().next().value);
        coverCache.set(url, hit);
        applyCover(hit.du, hit.colors, url);
      } catch (e) {
        console.error("GlassHome cover", e);
        setColors(FALLBACK.c1, FALLBACK.c2);
      }
    };
    img.onerror = () => {
      if (token === colorToken) setColors(FALLBACK.c1, FALLBACK.c2);
    };
    img.src = url;
  }

  // ---------- Home hero ----------
  const hero = el("section", "dex-hero");
  hero.innerHTML =
    '<div class="dex-hero__from"></div>' +
    '<div class="dex-hero__title"></div>' +
    '<button type="button" class="dex-hero__artist"></button>' +
    '<div class="dex-hero__actions">' +
    '<button type="button" class="dex-btn dex-btn--solid" data-act="play"></button>' +
    '<button type="button" class="dex-btn dex-btn--glass" data-act="lyrics">Lyrics</button>' +
    "</div>";
  const heroHost = el("div", "dex-hero-host");
  heroHost.append(hero);
  // Inside #main (not <body>): then the top bar (z-index 20) and the hero (z-index 3) share one stacking
  // context, so the search dropdown can sit above the hero. Appended to the root container, never into
  // a React-rendered element (that crashed the page earlier).
  (document.getElementById("main") || document.body).append(heroHost);
  const heroFrom = hero.querySelector(".dex-hero__from");
  const heroTitle = hero.querySelector(".dex-hero__title");
  const heroArtist = hero.querySelector(".dex-hero__artist");
  const heroPlay = hero.querySelector('[data-act="play"]');

  heroPlay.addEventListener("click", () => Spicetify.Player.togglePlay());
  hero.querySelector('[data-act="lyrics"]').addEventListener("click", () => {
    // Use the player's own lyrics button; pushing /lyrics by hand left the router in a bad state.
    const btn = [...document.querySelectorAll("[data-testid='now-playing-bar'] button")].find(b => /lyrics|letra/i.test(b.getAttribute("aria-label") || ""));
    if (btn) btn.click();
  });
  heroArtist.addEventListener("click", () => {
    const to = uriToPath(Spicetify.Player.data?.item?.artists?.[0]?.uri);
    if (to) History.push(to);
  });

  function contextName(data) {
    const ctx = data.context || {};
    const meta = ctx.metadata || {};
    if (meta.context_description) return meta.context_description;
    const item = data.item || {};
    const type = String(ctx.uri || "").split(":")[1];
    if (/:collection/.test(ctx.uri || "")) return "Liked Songs";
    if (type === "album") return item.album?.name || item.metadata?.album_title || "Album";
    if (type === "artist") return item.artists?.[0]?.name || "Artist";
    if (type === "playlist") return "Playlist";
    return "your queue";
  }

  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  let lastPlayHtml = "";

  function updateHero() {
    const data = Spicetify.Player.data || (Spicetify.Platform.PlayerAPI && Spicetify.Platform.PlayerAPI._state);
    const item = data && data.item;
    if (!item) return;
    setText(heroFrom, `Now playing from ${contextName(data)}`);
    setText(heroTitle, item.name || item.metadata?.title || "");
    setText(heroArtist, (item.artists || []).map(a => a.name).join(", ") || item.metadata?.artist_name || "");
    const paused = Spicetify.Player.isPlaying ? !Spicetify.Player.isPlaying() : data.isPaused;
    const html = paused ? `${ICON_PLAY}<span>Play</span>` : `${ICON_PAUSE}<span>Pause</span>`;
    if (html !== lastPlayHtml) {
      lastPlayHtml = html;
      heroPlay.innerHTML = html;
    }
  }

  // The hero is deliberately NOT inserted into Spotify's React tree (that crashed the page when
  // routes changed); it floats over the main view and follows its scroll position.
  let vp = null;
  let syncQueued = false;
  function syncHero() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      if (!vp || !vp.isConnected) vp = document.querySelector(".dex-main [data-overlayscrollbars-viewport], .dex-main .os-viewport");
      hero.style.transform = `translateY(${-(vp ? vp.scrollTop : 0)}px)`;
    });
  }

  // The hero floats above the page, so a wheel turned over its buttons would never reach the scroller:
  // forward it.
  heroHost.addEventListener("wheel", e => {
    if (!vp || !vp.isConnected) vp = document.querySelector(".dex-main [data-overlayscrollbars-viewport], .dex-main .os-viewport");
    if (vp) vp.scrollBy({ top: e.deltaY, left: e.deltaX });
  }, { passive: true });

  function layoutHero() {
    const main = document.querySelector(".dex-main");
    if (!main || !heroHost.classList.contains("is-on")) return;
    const r = main.getBoundingClientRect();
    Object.assign(heroHost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    const h = Math.ceil(hero.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty("--dex-hero-h", h + "px");
    syncHero();
  }

  // Only class toggles here (no layout reads); layoutHero runs when the hero appears or main resizes.
  function mountHero() {
    const main = document.querySelector(".dex-main");
    const on = !!(main && path() === "/" && playbackItem() && document.querySelector('section[data-testid="home-page"]'));
    const was = heroHost.classList.contains("is-on");
    if (on !== was) {
      heroHost.classList.toggle("is-on", on);
      document.documentElement.classList.toggle("dex-has-hero", on);
    }
    if (!on) return;
    updateHero();
    if (!was) layoutHero();
  }

  let roTarget = null;
  const mainResize = new ResizeObserver(layoutHero);
  function watchMain() {
    const main = document.querySelector(".dex-main");
    if (main && main !== roTarget) {
      mainResize.disconnect();
      mainResize.observe(main);
      roTarget = main;
    }
  }

  // Spotify paints page colour with layers whose class names change (playlist header gradient, solid
  // black action bar, black side-panel body). They are found by what is actually painted: sample a grid
  // of points in a container and make every large opaque / gradient surface under them see-through.
  const SAMPLE_X = [0.2, 0.5, 0.8];
  const SAMPLE_Y = [0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92];
  const KEEP = '[data-testid="tracklist-row"], .main-card-card, [data-encore-id="card"], button, a, input, .dex-hero-host';

  function sweepContainer(box, minFrac) {
    if (!box) return;
    const r = box.getBoundingClientRect();
    if (!r.width) return;
    const seen = new Set();
    const pts = [];
    for (const fx of SAMPLE_X) {
      for (const fy of SAMPLE_Y) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
      for (const dy of [14, 34, 56, 80, 110]) pts.push([r.left + r.width * fx, r.top + dy]);
    }
    for (const [px, py] of pts) {
      {
        for (const n of document.elementsFromPoint(px, py)) {
          if (seen.has(n)) continue;
          seen.add(n);
          if (n === box || !box.contains(n) || n.tagName === "IMG" || n.tagName === "VIDEO" || n.tagName === "CANVAS") continue;
          if (n.classList.contains("dex-nobg") || n.classList.contains("dex-topbar")) continue;
          if (n.clientWidth < r.width * minFrac || n.clientHeight < 60) continue;
          if (n.closest(KEEP)) continue;
          const cs = getComputedStyle(n);
          if (/url\(["']?https?:/.test(cs.backgroundImage || "")) continue; // keep remote pictures (artist header photo), not the data: noise texture
          // Spotify fades the colour in on scroll, so the layer can still be transparent when sampled.
          if (n.clientHeight <= 140 && /^(absolute|sticky|fixed)$/.test(cs.position) && n.getBoundingClientRect().top - r.top < 20) {
            tag(n, "dex-topbar");
            continue;
          }
          const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
          const parts = m ? m[1].split(",") : [];
          const alpha = parts.length > 3 ? parseFloat(parts[3]) : parts.length ? 1 : 0;
          const gradient = cs.backgroundImage && cs.backgroundImage.includes("gradient");
          if (alpha < 0.35 && !gradient) continue;
          const nearTop = n.getBoundingClientRect().top - r.top < 100 && n.clientHeight < 140;
          tag(n, nearTop ? "dex-topbar" : "dex-nobg");
        }
      }
    }
  }

  let lastSurfaces = 0;
  function sweepSurfaces(force) {
    const now = performance.now();
    if (!force && now - lastSurfaces < 700) return;
    lastSurfaces = now;
    sweepContainer(document.querySelector(".dex-main"), 0.5);
    sweepContainer(document.querySelector(".dex-right"), 0.6);
  }
  const sweepTop = () => sweepSurfaces(true);

  // An artist's header photo hangs off .main-view-container, outside the scroller. Spotify keeps it pinned to
  // the top and covers it with an opaque colour layer as the page scrolls; this theme makes that colour
  // see-through, so the photo is faded out by scroll position instead.
  // The value lives in a CSS variable on <html> (an element Spotify never re-creates) and user.css applies it to
  // the photo's container. Two earlier versions wrote opacity straight onto Spotify's element and listened to
  // every scroll event under the main view: a carousel scrolling (scrollTop 0) or a re-render of the photo
  // brought it back to full opacity.
  let mainVp = null;
  const getMainVp = () => {
    if (!mainVp || !mainVp.isConnected) mainVp = document.querySelector(".dex-main .dex-vp");
    return mainVp;
  };
  let lastPhotoFade = "";
  function fadePhoto() {
    const vp = getMainVp();
    const o = vp ? Math.max(0, Math.min(1, 1 - vp.scrollTop / 300)) : 1;
    const v = o.toFixed(3);
    if (v === lastPhotoFade) return;
    lastPhotoFade = v;
    document.documentElement.style.setProperty("--dex-photo", v);
  }

  document.addEventListener("scroll", e => {
    if (!(e.target && e.target.nodeType === 1 && e.target.closest(".dex-main"))) return;
    if (e.target === getMainVp()) fadePhoto(); // only the page scroller: carousels and nested scrollers are ignored
    syncHero();
    if (topQueued) return;
    topQueued = true;
    setTimeout(() => {
      topQueued = false;
      sweepTop();
    }, 150);
  }, { capture: true, passive: true });

  // ---------- wiring ----------
  function refreshPage() {
    const wanted = coverUrl(playbackItem());
    if (wanted && wanted !== coverShown && wanted !== coverLoading) updateColors();
    tagShell();
    watchMain();
    mountHero();
    sweepSurfaces();
    fadePhoto();
  }

  let queued = false;
  const hasElements = list => {
    for (const n of list) if (n.nodeType === 1) return true;
    return false;
  };
  const observer = new MutationObserver(muts => {
    if (queued) return;
    const relevant = muts.some(m => {
      const t = m.target;
      if (heroHost.contains(t) || bg.contains(t)) return false;
      if (t.closest && t.closest("[data-testid='now-playing-bar']")) return false;
      return hasElements(m.addedNodes) || hasElements(m.removedNodes);
    });
    if (!relevant) return; // text-only updates (player clock, counters) never need a relayout
    queued = true;
    setTimeout(() => {
      queued = false;
      refreshPage();
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  History.listen(() => {
    refreshPage();
    for (const ms of [200, 700, 1600]) setTimeout(() => { sweepSurfaces(true); fadePhoto(); }, ms);
  });
  Spicetify.Player.addEventListener("songchange", () => {
    updateHero();
    updateColors();
    requestAnimationFrame(layoutHero); // a longer title can change the hero's height
  });
  Spicetify.Player.addEventListener("onplaypause", updateHero);

  // Lite mode (profile menu): no backdrop blur, no cover layer, no animations.
  const LITE_KEY = "dex-lite-v2"; // v2: an earlier accidental "on" is ignored
  const applyLite = on => document.documentElement.classList.toggle("dex-lite", on);
  let lite = false;
  try {
    lite = localStorage.getItem(LITE_KEY) === "1";
  } catch (e) {
    lite = false;
  }
  applyLite(lite);
  try {
    new Spicetify.Menu.Item("GlassHome: modo lite", lite, self => {
      self.setState(!self.isEnabled);
      applyLite(self.isEnabled);
      try {
        localStorage.setItem(LITE_KEY, self.isEnabled ? "1" : "0");
      } catch (e) {}
    }).register();
  } catch (e) {
    console.warn("GlassHome: menu item unavailable", e);
  }

  updateHero();
  updateColors();
  refreshPage();
})();
