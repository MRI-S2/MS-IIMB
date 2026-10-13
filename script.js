
let heroIntroReady = false;
function initRivePreloader() {
  const preloader = document.getElementById('preloader');
  const canvas = document.getElementById('riveCanvas');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let riveInstance = null;

  function reveal() {
    if (!preloader || preloader.dataset.done) return;
    preloader.dataset.done = 'true';
    if (riveInstance) {
      try { riveInstance.pause(); } catch (e) { /* already gone */ }
    }
    preloader.classList.add('is-hidden');
    heroIntroReady = true;
    document.dispatchEvent(new CustomEvent('preloaderdone'));
    setTimeout(() => preloader.remove(), 750);
  }

  if (!preloader) { heroIntroReady = true; return; }
  if (reduceMotion || !canvas || typeof rive === 'undefined') {
    setTimeout(reveal, reduceMotion ? 150 : 0);
    return;
  }

  try {
    riveInstance = new rive.Rive({
      src: 'images/signature.riv',
      canvas,
      autoplay: true,
      layout: new rive.Layout({ fit: 'contain', alignment: 'center' }),
      onLoad: () => { try { riveInstance.resizeDrawingSurfaceToCanvas(); } catch (e) { /* ignore */ } },
      onLoadError: () => reveal(),
      onStop: () => reveal(),
      onLoop: () => reveal(),
    });
    setTimeout(reveal, 6000); 
  } catch (err) {
    reveal();
  }
  setTimeout(reveal, 8500); 
}
initRivePreloader();



const AMBIENT_VOLUME = 0.65; 
const MUSIC_VOLUME = 0.40;   

const audioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let isPlaying = false;
  let stopFns = [];

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function createNoiseBuffer(c, seconds) {
    const length = Math.floor(c.sampleRate * seconds);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }


  function click() {
    if (!isPlaying || !ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1900, t);
    osc2.frequency.exponentialRampToValueAtTime(950, t + 0.1);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.13);
  }


  function start() {
    const c = ensureContext();
    if (isPlaying) return;
    isPlaying = true;

    const noise = c.createBufferSource();
    noise.buffer = createNoiseBuffer(c, 4);
    noise.loop = true;

    const waveFilter = c.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.Q.value = 0.5;
    waveFilter.frequency.value = 220;

    const waveGain = c.createGain();
    waveGain.gain.value = 0.28;

    noise.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(masterGain);
    noise.start();

    const video = document.getElementById('aboutVideo');
    const FALLBACK_PERIOD = 10.135; // the coastline clip's own length, used only if the video is missing
    let rafId;
    function updateSwell() {
      let progress;
      if (video && !video.paused && video.duration && !isNaN(video.duration)) {
        progress = (video.currentTime % video.duration) / video.duration;
      } else {
        progress = ((performance.now() / 1000) % FALLBACK_PERIOD) / FALLBACK_PERIOD;
      }
      const swell = Math.sin(progress * Math.PI); // 0 at the loop edges, 1 at the midpoint (the crest)
      const now = c.currentTime;
      waveFilter.frequency.setTargetAtTime(220 + swell * 480, now, 0.15);
      waveGain.gain.setTargetAtTime(0.28 + swell * 0.34, now, 0.15);
      if (isPlaying) rafId = requestAnimationFrame(updateSwell);
    }
    updateSwell();

    stopFns = [
      () => noise.stop(),
      () => cancelAnimationFrame(rafId),
    ];

    masterGain.gain.cancelScheduledValues(c.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, c.currentTime);
    masterGain.gain.linearRampToValueAtTime(AMBIENT_VOLUME, c.currentTime + 1.3);
  }

  function stop() {
    if (!isPlaying || !ctx) return;
    isPlaying = false;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
    const fns = stopFns;
    stopFns = [];
    setTimeout(() => { fns.forEach((fn) => { try { fn(); } catch (e) { /* already stopped */ } }); }, 850);
  }

  function toggle() { if (isPlaying) stop(); else start(); return isPlaying; }
  function suspend() { if (ctx && isPlaying) ctx.suspend(); }
  function resume() { if (ctx && isPlaying) ctx.resume(); }

  return { toggle, click, suspend, resume, get isPlaying() { return isPlaying; } };
})();


function initOceanCanvas() {
  const canvas = document.getElementById('oceanCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx2d = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MOUSE_RADIUS = 260;   
  const MOUSE_STRENGTH = 46;  

  let width = 0, height = 0, dpr = 1;
  let ripples = [];
  let t = 0;
  let mouseX = -9999, mouseY = -9999; 

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

  function addRipple(x, y) {
    ripples.push({ x, y, r: 0, alpha: 0.4 });
    if (ripples.length > 4) ripples.shift();
  }
  window.addEventListener('click', (e) => addRipple(e.clientX, e.clientY));
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) addRipple(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  function drawFrame() {
    t += 0.006;

    const grad = ctx2d.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0b3a52');
    grad.addColorStop(0.55, '#062c40');
    grad.addColorStop(1, '#041c29');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, width, height);

    if (!reduceMotion) {
      const lineCount = width < 700 ? 3 : 4;
      const step = width < 700 ? 15 : 10;
      for (let w = 0; w < lineCount; w++) {
        ctx2d.beginPath();
        ctx2d.lineWidth = 1.5 + w * 0.3;
        ctx2d.strokeStyle = `rgba(45, 212, 198, ${0.11 - w * 0.02})`;
        const baseY = height * (0.2 + w * 0.2);
        const ampA = 36 + w * 10;
        const ampB = 17 + w * 6;
        const ampC = 9 + w * 4;
        for (let x = 0; x <= width; x += step) {
          
          let y = baseY
            + Math.sin(x * 0.006 + t * (1 + w * 0.3) + w * 2) * ampA
            + Math.sin(x * 0.017 - t * (1.6 + w * 0.25) + w) * ampB
            + Math.sin(x * 0.031 + t * (2.2 + w * 0.4)) * ampC;

          const dxm = x - mouseX;
          const dym = y - mouseY;
          const dist = Math.sqrt(dxm * dxm + dym * dym);
          if (dist < MOUSE_RADIUS) {
            const falloff = 1 - dist / MOUSE_RADIUS;
            y += Math.sin(dist * 0.045 - t * 5) * MOUSE_STRENGTH * falloff * falloff;
          }

          if (x === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      }
    }

    ripples.forEach((rip) => {
      rip.r += 3;
      rip.alpha *= 0.94;
      ctx2d.beginPath();
      ctx2d.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(255, 138, 101, ${rip.alpha})`;
      ctx2d.lineWidth = 2;
      ctx2d.stroke();

      ctx2d.beginPath();
      ctx2d.arc(rip.x, rip.y, rip.r * 0.7, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(45, 212, 198, ${rip.alpha * 0.7})`;
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();
    });
    ripples = ripples.filter((rip) => rip.alpha > 0.015);

    requestAnimationFrame(drawFrame);
  }
  drawFrame();
}

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsHover = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof gsap !== 'undefined';

  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('main section[id]');
  const yearSpan = document.getElementById('year');
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');
  const cursorDot = document.getElementById('cursorDot');
  const soundToggle = document.getElementById('soundToggle');
  const heroPhoto = document.getElementById('heroPhoto');
  const heroPhotoWrap = document.querySelector('.hero-photo-wrap');
  const aboutVideo = document.getElementById('aboutVideo');
  const bgMusic = document.getElementById('bgMusic');

  const MOBILE_BREAKPOINT = 860;
  let soundIsOn = false; 

  initOceanCanvas();

  
  if (aboutVideo && prefersReducedMotion) {
    aboutVideo.addEventListener('loadeddata', () => aboutVideo.pause(), { once: true });
  }
  /* play the About video only while the section is on (or near) the screen */
  if (aboutVideo && !prefersReducedMotion) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) aboutVideo.play().catch(() => {});
          else aboutVideo.pause();
        });
      }, { rootMargin: '200px 0px' }).observe(aboutVideo);
    } else {
      aboutVideo.play().catch(() => {});
    }
  }
  if (bgMusic) bgMusic.volume = MUSIC_VOLUME;

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();


  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });


  const closeMobileNav = () => {
    siteNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  };
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
  });
  navLinks.forEach((link) => link.addEventListener('click', closeMobileNav));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && siteNav.classList.contains('is-open')) {
      closeMobileNav();
      navToggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (siteNav.classList.contains('is-open') && !siteNav.contains(e.target) && !navToggle.contains(e.target)) {
      closeMobileNav();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_BREAKPOINT) closeMobileNav();
  });


  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId.length < 2) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const headerHeight = header.offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight + 1;
      window.scrollTo({ top: targetPosition, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      history.pushState(null, '', targetId);
    });
  });


  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('id');
        navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((section) => spy.observe(section));
  }


  if (contactForm) {
    const RECIPIENT_EMAIL = 'mridulsapra9@gmail.com';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = contactForm.name.value.trim();
      const email = contactForm.email.value.trim();
      const message = contactForm.message.value.trim();
      if (!name || !email || !message || !emailPattern.test(email)) {
        formStatus.textContent = 'Please fill in every field with a valid email address.';
        formStatus.dataset.state = 'error';
        return;
      }
      const subject = encodeURIComponent(`Portfolio message from ${name}`);
      const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
      window.location.href = `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`;
      formStatus.textContent = 'Opening your email client to send this message…';
      formStatus.dataset.state = 'success';
    });
  }

 
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundIsOn = audioEngine.toggle();
      soundToggle.classList.toggle('is-on', soundIsOn);
      soundToggle.setAttribute('aria-pressed', String(soundIsOn));
      if (bgMusic) {
        if (soundIsOn) bgMusic.play().catch(() => { /* no track added yet */ });
        else bgMusic.pause();
      }
    });
  }
  document.querySelectorAll('.btn, .nav-link, .nav-toggle, .icon-link, .linkedin-card').forEach((el) => {
    el.addEventListener('click', () => audioEngine.click());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audioEngine.suspend();
      if (bgMusic) bgMusic.pause();
    } else {
      audioEngine.resume();
      if (bgMusic && soundIsOn) bgMusic.play().catch(() => {});
    }
  });

 
  if (heroPhoto && heroPhotoWrap && supportsHover && hasGSAP && !prefersReducedMotion) {
    heroPhotoWrap.addEventListener('mousemove', (e) => {
      const rect = heroPhotoWrap.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(heroPhoto, { rotateY: relX * 26, rotateX: relY * -26, duration: 0.5, ease: 'power2.out' });
    });
    heroPhotoWrap.addEventListener('mouseleave', () => {
      gsap.to(heroPhoto, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'power2.out' });
    });
  }


  if (hasGSAP && !prefersReducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(['.hero-name', '.hero-role', '.hero-actions', '.hero-photo-wrap'], { opacity: 0, y: 26 });
    const heroTl = gsap.timeline({ paused: true })
      .to('.hero-photo-wrap', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
      .to('.hero-name', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.55')
      .to('.hero-role', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.55')
      .to('.hero-actions', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.15');

    if (heroIntroReady) heroTl.play();
    else document.addEventListener('preloaderdone', () => heroTl.play(), { once: true });

    document.querySelectorAll('.section').forEach((section) => {
      const heading = section.querySelector('h2');
      const rule = section.querySelector('.rule');
      if (heading) {
        gsap.set(heading, { opacity: 0, y: 24 });
        gsap.to(heading, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: section, start: 'top 78%' } });
      }
      if (rule) {
        gsap.set(rule, { scaleX: 0, transformOrigin: 'left center' });
        gsap.to(rule, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', scrollTrigger: { trigger: section, start: 'top 78%' } });
      }
    });

    ['.ledger', '.tile-grid', '.hobby-grid', '.lang-list'].forEach((sel) => {
      document.querySelectorAll(sel).forEach((group) => {
        const items = group.children;
        gsap.set(items, { opacity: 0, y: 30 });
        gsap.to(items, {
          opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: group, start: 'top 85%' },
        });
      });
    });

    ['.about-text', '.contact-intro', '.linkedin-card', '.contact-form'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      gsap.set(el, { opacity: 0, y: 24 });
      gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    const statementLines = document.querySelectorAll('.statement-text .line');
    if (statementLines.length) {
      gsap.set(statementLines, { opacity: 0, y: 30 });
      gsap.to(statementLines, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15,
        scrollTrigger: { trigger: '.statement', start: 'top 75%' },
      });
    }

    document.querySelectorAll('.stat-num').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: target, duration: 1.6, ease: 'power2.out',
            onUpdate: () => { el.textContent = obj.val.toFixed(1) + suffix; },
          });
        },
      });
    });

    if (supportsHover) {
      document.querySelectorAll('.btn').forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          gsap.to(btn, {
            x: (e.clientX - rect.left - rect.width / 2) * 0.25,
            y: (e.clientY - rect.top - rect.height / 2) * 0.4,
            duration: 0.3, ease: 'power2.out',
          });
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
        });
      });
    }

    if (cursorDot && supportsHover) {
      document.body.classList.add('has-custom-cursor');

      gsap.set(cursorDot, { xPercent: 0, yPercent: 0 });
      window.addEventListener('mousemove', (e) => {
        gsap.set(cursorDot, { x: e.clientX, y: e.clientY });
      });
      document.querySelectorAll('a, button, .hobby-card, .tile, .linkedin-card').forEach((el) => {
        el.addEventListener('mouseenter', () => cursorDot.classList.add('is-active'));
        el.addEventListener('mouseleave', () => cursorDot.classList.remove('is-active'));
      });
    }
  } else {
    document.querySelectorAll('.stat-num').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      el.textContent = target.toFixed(1) + suffix;
    });
  }
});
