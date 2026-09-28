import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/base.css';
import './styles/home.css';
import { startClock } from './shared/clock';
import { githubStats } from './shared/github';

startClock();

const gh = document.querySelector<HTMLElement>('[data-github-stats]');
if (gh) githubStats(gh);

// Fade sections in as they arrive.
const reveal = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
    }),
  { rootMargin: '0px 0px -8% 0px' }
);
document.querySelectorAll('[data-reveal]').forEach((e) => reveal.observe(e));

// Load and play the renderer demo only while it is on screen.
document.querySelectorAll<HTMLVideoElement>('video[data-lazy-video]').forEach((video) => {
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      const source = video.querySelector<HTMLSourceElement>('source[data-src]');
      if (source) {
        source.src = source.dataset.src!;
        source.removeAttribute('data-src');
        video.load();
      }
      video.play().catch(() => {});
    } else video.pause();
  }).observe(video);
});

const lab = document.querySelector<HTMLElement>('[data-lab]');
if (lab) {
  // Canvas textures print the lens scales, so the fonts must be ready first.
  Promise.all([
    document.fonts.load('600 40px "JetBrains Mono Variable"'),
    document.fonts.load('600 40px "Inter Variable"'),
  ])
    .catch(() => {})
    .then(() => import('./lab/lab'))
    .then(({ startLab }) => startLab(lab))
    .catch((err) => {
      lab.classList.add('is-fallback');
      console.warn(err);
    });
}
