const MIN_CHARACTERS = 2;
const MAX_CHARACTERS = 4;

// ikon sticker custom (bukan emoji) — lihat SPEC.md §7a
const ICON_CLAPPER = `<svg viewBox="0 0 48 48" width="30" height="30">
  <rect x="6" y="17" width="36" height="25" rx="4" fill="#f2e9d3" stroke="#2e2a24" stroke-width="3"/>
  <rect x="6" y="7" width="36" height="10" rx="3" fill="#2e2a24"/>
  <rect x="9" y="8.5" width="5.5" height="7" fill="#e8b923" transform="skewX(-18)"/>
  <rect x="16.5" y="8.5" width="5.5" height="7" fill="#f2e9d3" transform="skewX(-18)"/>
  <rect x="24" y="8.5" width="5.5" height="7" fill="#e8b923" transform="skewX(-18)"/>
  <rect x="31.5" y="8.5" width="5.5" height="7" fill="#f2e9d3" transform="skewX(-18)"/>
  <circle cx="24" cy="30" r="6.5" fill="#b3272c" stroke="#2e2a24" stroke-width="2.5"/>
  <path d="M22 27l4 3-4 3z" fill="#fff"/>
</svg>`;

const ICON_PLAY = `<svg viewBox="0 0 32 32" width="20" height="20">
  <circle cx="16" cy="16" r="14" fill="#b3272c" stroke="#2e2a24" stroke-width="2.5"/>
  <path d="M13 10.5 23 16 13 21.5Z" fill="#fff" stroke="#2e2a24" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

const ICON_CANON = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6z" fill="#fff"/></svg>`;

const ICON_FILLER = `<svg viewBox="0 0 24 24" width="12" height="12">
  <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/>
  <path d="M12 7v5l4 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const slotsContainer = document.getElementById('character-slots');
const addCharacterBtn = document.getElementById('add-character-btn');
const searchBtn = document.getElementById('search-btn');
const formMessage = document.getElementById('form-message');
const resultsEl = document.getElementById('results');

let characters = [];
let slotCount = MIN_CHARACTERS;

function renderSlots() {
  const previousValues = Array.from(slotsContainer.querySelectorAll('select')).map((s) => s.value);
  slotsContainer.innerHTML = '';

  for (let i = 0; i < slotCount; i += 1) {
    const row = document.createElement('div');
    row.className = 'character-slot';

    const select = document.createElement('select');
    select.dataset.index = String(i);

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Pilih karakter --';
    select.appendChild(placeholder);

    for (const character of characters) {
      const option = document.createElement('option');
      option.value = String(character.id);
      option.textContent = character.name;
      select.appendChild(option);
    }

    if (previousValues[i]) {
      select.value = previousValues[i];
    }

    row.appendChild(select);

    // slot ke-3 & ke-4 boleh dihapus lagi (2 slot pertama wajib, sesuai MIN_CHARACTERS)
    if (i >= MIN_CHARACTERS) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-slot-btn';
      removeBtn.setAttribute('aria-label', 'Hapus slot karakter ini');
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        slotCount -= 1;
        renderSlots();
      });
      row.appendChild(removeBtn);
    }

    slotsContainer.appendChild(row);
  }

  addCharacterBtn.disabled = slotCount >= MAX_CHARACTERS;
}

async function loadCharacters() {
  try {
    const res = await fetch('/api/characters');
    if (!res.ok) throw new Error('Gagal memuat daftar karakter');
    characters = await res.json();
  } catch (err) {
    formMessage.textContent = 'Gagal memuat daftar karakter. Coba muat ulang halaman.';
  }
  renderSlots();
}

function getSelectedCharacterIds() {
  const values = Array.from(slotsContainer.querySelectorAll('select'))
    .map((s) => s.value)
    .filter((v) => v !== '');
  return [...new Set(values.map(Number))];
}

function getYoutubeVideoId(url) {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

// coba buka aplikasi YouTube native (mobile), fallback ke tab browser biasa kalau app tak ada/desktop
function openYoutube(webUrl) {
  const videoId = getYoutubeVideoId(webUrl);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (videoId && isAndroid) {
    // intent URL memicu chooser Android; kalau app YouTube terpasang akan langsung dibuka di sana
    window.location.href = `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;end`;
    return;
  }

  if (videoId && isIOS) {
    // custom scheme youtube:// tidak memberi sinyal balik kalau app tak terpasang,
    // jadi pasang fallback timer ke web kalau halaman ini masih aktif setelah sekian ms
    const fallbackTimer = setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 1200);
    window.addEventListener('pagehide', () => clearTimeout(fallbackTimer), { once: true });
    window.location.href = `youtube://www.youtube.com/watch?v=${videoId}`;
    return;
  }

  // desktop: tidak ada skema aplikasi native yang universal, buka tab baru seperti biasa
  window.open(webUrl, '_blank', 'noopener,noreferrer');
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  if (isLoading) {
    resultsEl.innerHTML = '<div class="state-message"><div class="spinner"></div>Mencari...</div>';
  }
}

function renderEmptyState() {
  resultsEl.innerHTML =
    '<div class="state-message">Belum ada episode di mana karakter-karakter ini muncul bersama</div>';
}

function renderResults(episodes) {
  if (episodes.length === 0) {
    renderEmptyState();
    return;
  }

  resultsEl.innerHTML = '';
  for (const ep of episodes) {
    const card = document.createElement('article');
    card.className = 'episode-card';

    const badgeClass = ep.is_filler ? 'badge-filler' : 'badge-canon';
    const badgeIcon = ep.is_filler ? ICON_FILLER : ICON_CANON;
    const badgeLabel = ep.is_filler ? 'Filler' : 'Canon';
    const watchButton = ep.youtube_url
      ? `<a class="btn-watch" href="${ep.youtube_url}" data-youtube-url="${ep.youtube_url}" rel="noopener noreferrer">${ICON_PLAY} Tonton</a>`
      : '';

    card.innerHTML = `
      <div class="card-icon">${ICON_CLAPPER}</div>
      <h3>${ep.title}</h3>
      <p class="ep-number">Episode ${ep.ep_number_int ?? '?'} (JP #${ep.ep_number_jp ?? '?'})</p>
      <span class="badge ${badgeClass}">${badgeIcon} ${badgeLabel}</span>
      <div>${watchButton}</div>
    `;

    resultsEl.appendChild(card);
  }
}

async function handleSearch() {
  formMessage.textContent = '';
  const ids = getSelectedCharacterIds();

  if (ids.length < MIN_CHARACTERS) {
    formMessage.textContent = `Pilih minimal ${MIN_CHARACTERS} karakter (belum boleh sama)`;
    return;
  }

  setLoading(true);
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_ids: ids }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Gagal mencari episode');
    }

    renderResults(data);
  } catch (err) {
    resultsEl.innerHTML = `<div class="state-message">${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

addCharacterBtn.addEventListener('click', () => {
  if (slotCount < MAX_CHARACTERS) {
    slotCount += 1;
    renderSlots();
  }
});

searchBtn.addEventListener('click', handleSearch);

// delegasi klik tombol Tonton biar bisa coba buka app YouTube native dulu
resultsEl.addEventListener('click', (event) => {
  const link = event.target.closest('.btn-watch');
  if (!link) return;
  event.preventDefault();
  openYoutube(link.dataset.youtubeUrl);
});

loadCharacters();
