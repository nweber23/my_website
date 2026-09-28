/** Live Heilbronn time in any [data-clock] element. */
export function startClock() {
  const els = document.querySelectorAll<HTMLElement>('[data-clock], .nav__time');
  if (!els.length) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  const tick = () => {
    const text = fmt.format(new Date());
    els.forEach((e) => (e.textContent = text));
  };
  tick();
  window.setInterval(tick, 1000);
}
