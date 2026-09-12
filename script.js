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

  function activateTarget(id) {
    // Update readout
    if (coordsMap[id]) {
      coordsDisplay.textContent = coordsMap[id];
    }

    // Update tabs
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === id);
    });

    // Update blips
    blips.forEach(blip => {
      blip.classList.toggle('active', blip.dataset.id === id);
    });

    // Ensure target card is visible if hidden by filter
    const card = document.getElementById(`card-${id}`);
    if (card) {
      if (card.classList.contains('hidden-by-filter')) {
        // Reset filter to all so the target is viewable
        filterPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
        cards.forEach(c => c.classList.remove('hidden-by-filter'));
      }

      cards.forEach(c => c.classList.remove('active-target'));
      card.classList.add('active-target');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Wire up tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateTarget(tab.dataset.target);
    });
  });

  // Wire up blips
  blips.forEach(blip => {
    blip.addEventListener('click', () => {
      activateTarget(blip.dataset.id);
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
      const filter = pill.dataset.filter;
      filterPills.forEach(p => p.classList.toggle('active', p === pill));

      cards.forEach(card => {
        if (filter === 'all' || card.dataset.basin === filter) {
          card.classList.remove('hidden-by-filter');
        } else {
          card.classList.add('hidden-by-filter');
        }
      });
    });
  });

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
