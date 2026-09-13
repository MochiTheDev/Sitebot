document.addEventListener('DOMContentLoaded', () => {
  const coordsMap = {
    bermeja: '22°33′N 91°22′W',
    hybrasil: '52°12′N 13°40′W',
    kong: '09°20′N 02°15′W',
    sandy: '19°13′S 159°56′E',
    crocker: '83°00′N 103°00′W',
    frisland: '60°30′N 25°00′W',
    aurora: '52°30′S 47°40′W',
    saxemberg: '30°45′S 19°30′W',
    rupes: '90°00′N 00°00′E',
    mayda: '46°24′N 37°18′W',
    pepys: '47°00′S 64°00′W',
    dougherty: '59°20′S 120°20′W',
    emerald: '57°30′S 162°12′E',
    jardines: '21°30′N 153°00′E',
    byers: '28°32′N 177°04′E',
    groclant: '65°00′N 60°00′W',
    sarahann: '04°00′N 154°22′W',
    thompson: '54°26′S 03°24′E',
    demons: '50°45′N 55°30′W',
    antillia: '39°30′N 36°30′W',
    sanborondon: '28°00′N 20°30′W',
    satanazes: '41°30′N 36°30′W',
    morrell: '65°00′S 48°00′W',
    buss: '58°30′N 28°30′W',
    podesta: '32°14′S 89°08′W',
    nimrod: '56°30′S 158°30′W',
    royalcompany: '50°20′S 142°50′E',
    islagrande: '45°00′S 45°00′W',
    davis: '27°20′S 90°00′W',
    stmatthew: '01°50′S 08°00′W',
    mariatheresa: '37°00′S 151°13′W',
    ernestlegouve: '35°15′S 150°40′W',
    wachusett: '32°18′S 151°08′W',
    filippo: '05°30′S 151°47′W'
  };

  const coordsDisplay = document.getElementById('selected-coords');
  const tabs = document.querySelectorAll('.tab-btn');
  const blips = document.querySelectorAll('.radar-blip');
  const cards = document.querySelectorAll('.card');
  const filterPills = document.querySelectorAll('.filter-pill');
  const randomBtn = document.getElementById('random-target-btn');
  const searchInput = document.getElementById('dossier-search');
  const scrollTopBtn = document.getElementById('scroll-top-btn');
  const radarViewport = document.getElementById('radar-viewport');
  const radarTooltip = document.getElementById('radar-tooltip');

  let activeBasinFilter = 'all';
  let activeSearchTerm = '';

  function activateTarget(id) {
    if (coordsMap[id]) {
      coordsDisplay.textContent = coordsMap[id];
      coordsDisplay.classList.remove('copied');
    }

    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === id);
    });

    blips.forEach(blip => {
      blip.classList.toggle('active', blip.dataset.id === id);
    });

    const card = document.getElementById(`card-${id}`);
    if (card) {
      if (card.classList.contains('hidden-by-filter')) {
        activeBasinFilter = 'all';
        activeSearchTerm = '';
        if (searchInput) searchInput.value = '';
        filterPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
        applyFiltering();
      }

      cards.forEach(c => c.classList.remove('active-target'));
      card.classList.add('active-target');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function applyFiltering() {
    cards.forEach(card => {
      const basin = card.dataset.basin;
      const text = card.textContent.toLowerCase();
      const matchesBasin = (activeBasinFilter === 'all' || basin === activeBasinFilter);
      const matchesSearch = (!activeSearchTerm || text.includes(activeSearchTerm));

      if (matchesBasin && matchesSearch) {
        card.classList.remove('hidden-by-filter');
      } else {
        card.classList.add('hidden-by-filter');
      }
    });
  }

  // Wire up tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateTarget(tab.dataset.target);
    });
  });

  // Wire up blips and blip tooltips
  blips.forEach(blip => {
    blip.addEventListener('click', () => {
      activateTarget(blip.dataset.id);
    });

    blip.addEventListener('mouseenter', (e) => {
      const id = blip.dataset.id;
      const title = blip.getAttribute('title') || id;
      const coord = coordsMap[id] || '';
      radarTooltip.textContent = `${title} [${coord}]`;
      radarTooltip.classList.add('visible');
      
      const rect = blip.getBoundingClientRect();
      const parentRect = radarViewport.getBoundingClientRect();
      const x = rect.left - parentRect.left + 8;
      const y = rect.top - parentRect.top - 24;
      radarTooltip.style.left = `${Math.max(10, Math.min(x, parentRect.width - 150))}px`;
      radarTooltip.style.top = `${Math.max(6, y)}px`;
    });

    blip.addEventListener('mouseleave', () => {
      radarTooltip.classList.remove('visible');
    });
  });

  // Random jump button handler
  if (randomBtn) {
    const targetKeys = Object.keys(coordsMap);
    randomBtn.addEventListener('click', () => {
      const currentTarget = coordsDisplay.textContent;
      let available = targetKeys.filter(key => coordsMap[key] !== currentTarget);
      if (available.length === 0) available = targetKeys;
      const randomId = available[Math.floor(Math.random() * available.length)];
      activateTarget(randomId);
    });
  }

  // Ocean Basin Filter
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      activeBasinFilter = pill.dataset.filter;
      filterPills.forEach(p => p.classList.toggle('active', p === pill));
      applyFiltering();
    });
  });

  // Live search input handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchTerm = e.target.value.trim().toLowerCase();
      applyFiltering();
    });
  }

  // Click-to-copy coordinates
  if (coordsDisplay) {
    coordsDisplay.addEventListener('click', () => {
      const text = coordsDisplay.textContent;
      if (!text || text.includes('COPIED')) return;
      navigator.clipboard.writeText(text).then(() => {
        const original = text;
        coordsDisplay.textContent = 'COPIED!';
        coordsDisplay.classList.add('copied');
        setTimeout(() => {
          coordsDisplay.textContent = original;
          coordsDisplay.classList.remove('copied');
        }, 1500);
      }).catch(() => {});
    });
  }

  // Floating jump-to-radar button
  const radarScope = document.getElementById('radar-scope');
  if (scrollTopBtn && radarScope) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        scrollTopBtn.classList.add('visible');
      } else {
        scrollTopBtn.classList.remove('visible');
      }
    }, { passive: true });

    scrollTopBtn.addEventListener('click', () => {
      radarScope.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Bookmark / Share button trigger
  const bookmarkBtn = document.getElementById('bookmark-hint-btn');
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'The Phantom Atlas',
          text: 'Explore islands and mountain ranges that existed on maps for centuries, but never in reality.',
          url: window.location.href
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        bookmarkBtn.textContent = 'Link Copied!';
        setTimeout(() => {
          bookmarkBtn.textContent = 'Bookmark Archive';
        }, 2500);
      }
    });
  }
});
