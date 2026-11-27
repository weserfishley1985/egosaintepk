const mediaDialog = document.querySelector('#media-dialog');
const mediaStage = mediaDialog.querySelector('.media-stage');
const showPlaylists = mediaDialog.querySelectorAll('.show-playlist');
const photoAlbums = Array.from(mediaDialog.querySelectorAll('.show-playlist button[aria-controls]'), browse => {
  const grid = document.getElementById(browse.getAttribute('aria-controls'));
  return { grid, browse, links: Array.from(grid.querySelectorAll('a')) };
});
const photoPaging = mediaDialog.querySelector('.photo-paging');
let activeAlbum;
let selectedPhoto = -1;
const contactDialog = document.querySelector('#contact-dialog');

function showDialog(dialog) {
  dialog.showModal();
  document.body.classList.add('modal-open');
}

for (const link of document.querySelectorAll('.show-media [data-media], .single-play, #media-dialog [data-media]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const title = link.dataset.title || link.firstChild.textContent.trim();
    const type = link.dataset.media;
    const playable = type === 'video' || type === 'audio';
    const previousPlayer = mediaStage.querySelector('video, audio');
    previousPlayer?.pause();
    if (previousPlayer && !playable) mediaDialog.dispatchEvent(new Event('player-close'));
    activeAlbum = photoAlbums.find(album => album.grid.contains(link));
    const fromGrid = activeAlbum?.grid.contains(document.activeElement);
    selectedPhoto = activeAlbum ? activeAlbum.links.indexOf(link) : -1;
    for (const {grid, browse} of photoAlbums) {
      grid.hidden = true;
      browse.setAttribute('aria-expanded', 'false');
    }
    photoPaging.hidden = selectedPhoto < 0;
    if (!photoPaging.hidden) {
      photoPaging.querySelector('span').textContent = (selectedPhoto + 1) + ' of ' + activeAlbum.links.length;
      if (fromGrid) activeAlbum.browse.focus();
    }
    for (const playlist of showPlaylists) {
      playlist.hidden = playlist.id !== link.dataset.playlist && !playlist.contains(link);
      for (const item of playlist.querySelectorAll('a')) {
        if (!playlist.hidden && item.href === link.href) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    }
    const media = document.createElement(playable ? type : 'img');
    if (playable) {
      media.controls = true;
      if (type === 'video') media.playsInline = true;
      media.preload = 'metadata';
      media.setAttribute('aria-label', title);
    } else {
      media.alt = link.dataset.alt || title;
    }
    media.addEventListener('error', () => {
      if (!mediaStage.contains(media)) return;
      if (playable) mediaDialog.dispatchEvent(new Event('player-close'));
      const fallback = document.createElement('a');
      fallback.href = link.href;
      fallback.textContent = 'Open the original file';
      mediaStage.replaceChildren('This file could not be displayed. ', fallback);
    }, { once: true });
    mediaDialog.querySelector('h2').textContent = title;
    mediaStage.replaceChildren(media);
    if (type === 'audio') {
      const cover = link.querySelector('img').cloneNode();
      cover.className = 'track-art';
      cover.loading = 'eager';
      mediaStage.prepend(cover);
    }
    media.src = link.href;
    if (!mediaDialog.open) showDialog(mediaDialog);
    if (playable) {
      if (!previousPlayer) mediaDialog.dispatchEvent(new Event('player-open'));
      media.play().catch(() => {});
    }
  });
}

for (const { grid, browse, links } of photoAlbums) {
  browse.addEventListener('click', () => {
    const player = mediaStage.querySelector('video, audio');
    if (player) {
      player.pause();
      mediaDialog.dispatchEvent(new Event('player-close'));
    }
    mediaStage.replaceChildren();
    for (const link of browse.parentElement.querySelectorAll('[aria-current]')) link.removeAttribute('aria-current');
    mediaDialog.querySelector('h2').textContent = grid.dataset.title;
    grid.hidden = false;
    photoPaging.hidden = true;
    browse.setAttribute('aria-expanded', 'true');
    links[Math.max(selectedPhoto, 0)].focus();
  });
}

for (const button of photoPaging.querySelectorAll('button')) {
  button.addEventListener('click', () => {
    const links = activeAlbum.links;
    const index = (selectedPhoto + Number(button.dataset.step) + links.length) % links.length;
    links[index].click();
  });
}

mediaDialog.addEventListener('close', () => {
  if (mediaDialog.open) return;
  const player = mediaStage.querySelector('video, audio');
  if (player) {
    player.pause();
    mediaDialog.dispatchEvent(new Event('player-close'));
  }
  mediaStage.replaceChildren();
});

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;

    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]')));
  });
}

for (const button of document.querySelectorAll('[data-open-contact]')) {
  button.addEventListener('click', () => showDialog(contactDialog));
}

const bookingForm = contactDialog.querySelector('form');
const sendButton = bookingForm.querySelector('[type="submit"]');
const emailLink = contactDialog.querySelector('.direct-email a');
const confirmation = document.querySelector('#message-sent');
const bookingStatus = document.querySelector('#booking-status');
let returnHomeTimer;
let lastPayload;
let submissionId;

function showReceipt() {
  if (contactDialog.open) contactDialog.close();
  showDialog(confirmation);
  returnHomeTimer = setTimeout(() => confirmation.close(), 3000);
}

confirmation.addEventListener('close', () => {
  clearTimeout(returnHomeTimer);
  history.replaceState(history.state, '', location.pathname + location.search);
  document.querySelector('header a').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
});

emailLink.addEventListener('click', () => {
  const fields = new FormData(bookingForm);
  const body = [fields.get('message'), fields.get('name'), fields.get('email')].filter(Boolean).join('\n\n');
  emailLink.href = 'mailto:egosaintmusic@gmail.com?subject=' + encodeURIComponent(fields.get('_subject')) +
    '&body=' + encodeURIComponent(body);
});

async function forwardSavedInquiry(formId, fields, id) {
  if (!/^[a-z0-9]{8,32}$/i.test(formId ?? '')) return;
  const data = new URLSearchParams({
    name: fields.name, email: fields.email, message: fields.message, subject: fields._subject
  });
  let deliveryStatus = 'browser_unconfirmed';
  try {
    const response = await fetch('https://formspree.io/f/' + formId, {
      method: 'POST', body: data, headers: { Accept: 'application/json' }, keepalive: true
    });
    if (response.ok && (await response.json()).ok === true) deliveryStatus = 'browser_accepted';
  } catch {
    // The inquiry is already saved if the visitor loses their connection.
  }
  await fetch(bookingForm.action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, deliveryStatus }), keepalive: true
  }).catch(() => {});
}

bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (sendButton.disabled) return;
  const fields = Object.fromEntries(new FormData(bookingForm));
  const payload = JSON.stringify(fields);
  if (lastPayload !== payload) submissionId = crypto.randomUUID();
  lastPayload = payload;
  sendButton.disabled = true;
  sendButton.textContent = 'Sending…';
  bookingStatus.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(bookingForm.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, id: submissionId, browserDelivery: true }),
      signal: controller.signal
    });
    const saved = await res.json();
    if (!res.ok || saved.success !== true) throw new Error('Unconfirmed save');
    if (saved.formId) void forwardSavedInquiry(saved.formId, fields, submissionId);
    lastPayload = null;
    bookingForm.reset();
    showReceipt();
  } catch {
    bookingStatus.textContent = 'We couldn’t confirm receipt. Your message is still here. Please try again or email the band below.';
  } finally {
    clearTimeout(timeout);
    sendButton.disabled = false;
    sendButton.textContent = 'Send message';
  }
});

const pageUrl = new URL(location.href);
if (pageUrl.searchParams.get('booking') === 'sent') {
  pageUrl.searchParams.delete('booking');
  history.replaceState(history.state, '', pageUrl.pathname + pageUrl.search);
  showReceipt();
}

const music = document.querySelector('#background-music');
const musicButton = document.querySelector('.hero-audio');

function startNativeMusic(autoplay) {
  let restoreSound = false;
  mediaDialog.addEventListener('player-open', () => {
    restoreSound = !music.muted && (autoplay || !music.paused);
    if (!autoplay) music.pause();
    music.muted = true;
  });
  mediaDialog.addEventListener('player-close', () => {
    if (restoreSound) {
      music.muted = false;
      if (!autoplay && music.paused) music.play().catch(updateLabel);
    }
    restoreSound = false;
  });
  function updateLabel() {
    musicButton.textContent = music.paused || music.muted ? 'Unmute' : 'Mute';
  }

  for (const event of ['play', 'pause', 'volumechange']) {
    music.addEventListener(event, updateLabel);
  }

  musicButton.addEventListener('click', async () => {
    if (!music.paused && !music.muted) {
      music.muted = true;
      return;
    }

    if (music.error) music.load();
    music.muted = false;
    try {
      await music.play();
    } catch {
      musicButton.textContent = 'Retry audio';
    }
  });

  if (!autoplay) {
    music.preload = 'metadata';
    music.src = music.dataset.src;
    return;
  }

  function startMusicOnClick(event) {
    if (music.paused && !musicButton.contains(event.target)) music.play().catch(() => {});
  }

  document.addEventListener('click', startMusicOnClick, { capture: true, once: true });
  music.addEventListener('play', () => {
    document.removeEventListener('click', startMusicOnClick, true);
  }, { once: true });
  music.autoplay = true;
  music.src = music.dataset.src;
}

const mobileMusic = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
musicButton.hidden = false;
startNativeMusic(!mobileMusic);
