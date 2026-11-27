const hero = document.querySelector('.hero');
const montageFrames = [...hero.querySelectorAll('.montage-frame')];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const frameLoads = new Map();
let currentFrame = 0;
let heroInView = true;
let slideTimer;
let playbackVersion = 0;

function queueNextFrame() {
  clearTimeout(slideTimer);
  const version = ++playbackVersion;
  if (motionPreference.matches || !heroInView || document.hidden) return;

  // Prepare the next composition while the current one is on screen.
  const nextReady = findNextFrame(currentFrame, version);
  slideTimer = setTimeout(async () => {
    const nextFrame = await nextReady;
    if (version !== playbackVersion || nextFrame === undefined) return;
    montageFrames[currentFrame].classList.remove('is-current');
    montageFrames[nextFrame].classList.add('is-current');
    currentFrame = nextFrame;
    queueNextFrame();
  }, Number(montageFrames[currentFrame].dataset.hold));
}

function prepareFrame(index) {
  const frame = montageFrames[index];
  if (!frameLoads.has(index)) {
    frame.querySelectorAll('source[data-srcset]').forEach(source => {
      source.srcset = source.dataset.srcset;
    });
    const decodes = [...frame.querySelectorAll('img')].map(image => {
      if (image.dataset.src) image.src = image.dataset.src;
      return image.decode();
    });
    frameLoads.set(index, Promise.all(decodes).then(() => true, () => false));
  }
  return frameLoads.get(index);
}

async function findNextFrame(from, version) {
  for (let offset = 1; offset < montageFrames.length; offset++) {
    if (version !== playbackVersion) return;
    const index = (from + offset) % montageFrames.length;
    if (await prepareFrame(index)) return index;
  }
}

motionPreference.addEventListener('change', queueNextFrame);
document.addEventListener('visibilitychange', queueNextFrame);
new IntersectionObserver(([entry]) => {
  heroInView = entry.isIntersecting;
  queueNextFrame();
}).observe(hero);
