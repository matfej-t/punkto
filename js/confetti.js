// Subtle, dependency-free confetti (canvas). Skipped for reduced-motion users.

export function confetti({ duration = 3200, count = 140 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--accent-2', '--gold', '--silver']
    .map(v => css.getPropertyValue(v).trim()).filter(Boolean).concat(['#FFD166', '#EF476F']);
  const W = canvas.width, H = canvas.height;
  const parts = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: -Math.random() * H * 0.5,
    vx: (Math.random() - 0.5) * 2.2 * dpr,
    vy: (1.6 + Math.random() * 2.6) * dpr,
    w: (6 + Math.random() * 6) * dpr,
    h: (8 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    c: colors[(Math.random() * colors.length) | 0]
  }));
  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = t > duration - 600 ? Math.max(0, (duration - t) / 600) : 1;
    for (const p of parts) {
      p.x += p.vx + Math.sin((t / 400) + p.r) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
