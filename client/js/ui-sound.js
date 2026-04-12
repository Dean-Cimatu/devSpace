// UI hover sound for non-game pages
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const hoverAudio = new Audio('/assets/soundEffects/buttonHover.wav');
    hoverAudio.preload = 'auto';
    hoverAudio.volume = 1.0;

    const attachHover = (btn) => {
      if (!btn || btn.__hoverBound) return;
      btn.__hoverBound = true;
      btn.addEventListener('mouseenter', () => {
        try {
          hoverAudio.currentTime = 0;
          hoverAudio.play().catch(() => {});
        } catch (e) {}
      });
    };

    document.querySelectorAll('button').forEach(attachHover);

    const mo = new MutationObserver(() => {
      document.querySelectorAll('button').forEach(attachHover);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
