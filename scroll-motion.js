{
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowScreen = matchMedia('(max-width: 700px)');
  const heroSection = document.querySelector('.hero');
  const panels = [...document.querySelectorAll('.motion-panel')];
  let requestedFrame = 0;

  function updateLayers() {
    requestedFrame = 0;
    if (reducedMotion.matches) return;

    const viewport = window.innerHeight;
    const narrow = narrowScreen.matches;
    const heroBounds = heroSection.getBoundingClientRect();
    const panelBounds = panels.map(panel => [panel, panel.getBoundingClientRect()]);

    function drift(bounds, limit) {
      const center = bounds.top + bounds.height / 2;
      const travel = (viewport + bounds.height) / 2;
      return Math.max(-1, Math.min(1, (viewport / 2 - center) / travel)) * limit;
    }

    const heroTravel = Math.min(heroBounds.height, Math.max(0, -heroBounds.top));
    heroSection.style.setProperty('--hero-drift', `${heroTravel * (narrow ? .38 : .72)}px`);
    for (const [panel, bounds] of panelBounds) {
      panel.style.setProperty('--panel-drift', `${drift(bounds, narrow ? 26 : 54)}px`);
    }
  }

  function requestMotionFrame() {
    if (!requestedFrame && !reducedMotion.matches) requestedFrame = requestAnimationFrame(updateLayers);
  }

  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('revealed');
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -4% 0px', threshold: 0.08 });

  document.querySelectorAll('[data-reveal]').forEach(element => reveal.observe(element));
  document.documentElement.classList.add('reveal-enabled');
  addEventListener('scroll', requestMotionFrame, { passive: true });
  addEventListener('resize', requestMotionFrame);
  reducedMotion.addEventListener('change', requestMotionFrame);
  new ResizeObserver(requestMotionFrame).observe(document.querySelector('main'));
  requestMotionFrame();
}
