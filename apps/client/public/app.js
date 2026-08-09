(function(){
  // Scroll progress bar
  var bar = document.getElementById('scrollProgress');
  function updateBar(){
    var h = document.documentElement;
    var scrolled = h.scrollTop || document.body.scrollTop;
    var max = (h.scrollHeight - h.clientHeight) || 1;
    var pct = Math.min(100, Math.max(0, (scrolled / max) * 100));
    bar.style.width = pct + '%';
  }
  window.addEventListener('scroll', updateBar, {passive:true});
  window.addEventListener('resize', updateBar);
  updateBar();

  // Reveal-on-scroll using IntersectionObserver
  var revealEls = document.querySelectorAll('.reveal, .stagger');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:0.15, rootMargin:'0px 0px -8% 0px'});
    revealEls.forEach(function(el){ io.observe(el); });

    // Add reveal/in-view to the ladder for the connecting line draw
    var ladder = document.querySelector('.ladder');
    if (ladder) {
      var lio = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting){ e.target.classList.add('in-view'); lio.unobserve(e.target); }
        });
      }, {threshold:0.2});
      lio.observe(ladder);
    }

    // Receipt artifact reveal triggers stamp via .in-view on wrap
    var receiptWrap = document.querySelector('.receipt-wrap');
    if (receiptWrap){
      var rio = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting){ e.target.classList.add('in-view'); rio.unobserve(e.target); }
        });
      }, {threshold:0.4});
      rio.observe(receiptWrap);
    }
  } else {
    // Fallback: just show everything
    revealEls.forEach(function(el){ el.classList.add('in-view'); });
  }

  // Count-up for stat figures
  function countUp(el){
    var target = parseFloat(el.getAttribute('data-count-to'));
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    if (isNaN(target)) return;
    var duration = 1600;
    var start = performance.now();
    var startVal = 0;
    function frame(now){
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = Math.round(startVal + (target - startVal) * eased);
      var formatted = val.toLocaleString('en-US');
      el.textContent = prefix + formatted + suffix;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Glow pulse on completion
        el.classList.add('counted');
        setTimeout(function(){ el.classList.remove('counted'); }, 1000);
      }
    }
    requestAnimationFrame(frame);
  }
  var statEls = document.querySelectorAll('[data-count-to]');
  if ('IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ countUp(e.target); sio.unobserve(e.target); }
      });
    }, {threshold:0.5});
    statEls.forEach(function(el){ sio.observe(el); });
  } else {
    statEls.forEach(countUp);
  }

  // Receipt slash box: red flash when scrolled into view
  var slashBox = document.getElementById('slashBox');
  if (slashBox && 'IntersectionObserver' in window) {
    var flashIO = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){
          setTimeout(function(){
            slashBox.classList.add('flash-in');
            setTimeout(function(){ slashBox.classList.remove('flash-in'); }, 1300);
          }, 600);
          flashIO.unobserve(e.target);
        }
      });
    }, {threshold:0.8});
    flashIO.observe(slashBox);
  }

  // Button shimmer: track mouse position for radial spotlight
  document.querySelectorAll('.btn').forEach(function(btn){
    btn.addEventListener('mousemove', function(e){
      var r = btn.getBoundingClientRect();
      btn.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
      btn.style.setProperty('--by', ((e.clientY - r.top)  / r.height * 100) + '%');
    });
  });

  // Spotlight effect on usecase cards (mouse position)
  var ucCards = document.querySelectorAll('.usecase-card');
  ucCards.forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var rect = card.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
  });
})();

/* ===============================================================
   V20: nav dropdown toggle (Resources menu)
   =============================================================== */
(function(){
  var dds = document.querySelectorAll('.nav-dd');
  dds.forEach(function(dd){
    var btn = dd.querySelector('button');
    if (!btn) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var wasOpen = dd.classList.contains('open');
      dds.forEach(function(d){ d.classList.remove('open'); });
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', function(){
    dds.forEach(function(d){ d.classList.remove('open'); });
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') dds.forEach(function(d){ d.classList.remove('open'); });
  });
})();

/* ===============================================================
   V20: nav gains a hairline + slightly denser glass once scrolled
   =============================================================== */
(function(){
  var nav = document.querySelector('header.nav');
  if (!nav) return;
  function onScroll(){
    if ((window.scrollY || document.documentElement.scrollTop) > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

/* ===============================================================
   V23: the accountability loop.
   Four stages on a ring. One short line of copy at a time in the
   middle, so the section reads as a picture rather than four
   paragraphs. Auto-advances, pauses on hover/focus, and each node
   is a real button so it works by keyboard and without motion.

   To swap the worked example, edit STAGES below and the section
   sub-line in index.html. Nothing else references it.
   =============================================================== */
(function(){
  var cycle = document.getElementById('cycle');
  if (!cycle) return;

  var STAGES = [
    {step:'01 / HIRE',     title:'You pick with evidence',
     copy:'A 12,500 USDC bond. 1,284 clean receipts on record.', trust:'842', dropped:false},
    {step:'02 / WORK',     title:'It works in the open',
     copy:'Every trade writes a permanent on-chain receipt.',    trust:'842', dropped:false},
    {step:'03 / FAIL',     title:'One day it slips',
     copy:'A swap outside your mandate. The receipt is the proof.', trust:'842', dropped:false},
    {step:'04 / RECOURSE', title:'The bond pays you back',
     copy:'Challenge upheld, paid from its bond. No support ticket.', trust:'796', dropped:true}
  ];
  var STAGE_MS = 3600;   // matches the 14.4s comet orbit in the stylesheet

  var core   = cycle.querySelector('.cycle-core');
  var elStep = document.getElementById('ccStep');
  var elTitle= document.getElementById('ccTitle');
  var elCopy = document.getElementById('ccCopy');
  var elTrust= document.getElementById('ccTrust');
  var elTrustV = elTrust.querySelector('.cc-tv');
  var nodes  = Array.prototype.slice.call(cycle.querySelectorAll('.cyc-node'));
  var arcs   = Array.prototype.slice.call(cycle.querySelectorAll('.cyc-arc'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = 0, timer = null, running = false, swapTimer = null;

  function paint(i){
    var s = STAGES[i];
    elStep.textContent  = s.step;
    elTitle.textContent = s.title;
    elCopy.textContent  = s.copy;
    elTrustV.textContent = s.trust;
    elTrust.classList.toggle('dropped', s.dropped);
    nodes.forEach(function(n, k){ n.classList.toggle('is-active', k === i); });
    // arcs fill behind the pointer: the arc leaving the active node is live
    arcs.forEach(function(a, k){
      a.classList.toggle('drawn', k <= i);
      a.classList.toggle('live', k === i);
    });
  }

  function show(i, animate){
    index = ((i % STAGES.length) + STAGES.length) % STAGES.length;
    if (!animate || reduced){ paint(index); return; }
    // wrapping back to stage 1 clears the ring so the loop reads as a loop
    if (index === 0) arcs.forEach(function(a){ a.classList.remove('drawn','live'); });
    core.classList.add('swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(function(){
      paint(index);
      core.classList.remove('swapping');
    }, 280);
  }

  function start(){
    if (running || reduced) return;
    // never advance out from under someone who is reading a stage they
    // tabbed to: the pointer leaving is not enough if focus is still inside
    if (cycle.contains(document.activeElement)) return;
    running = true;
    cycle.classList.remove('is-paused');
    timer = setInterval(function(){ show(index + 1, true); }, STAGE_MS);
  }
  function stop(){
    running = false;
    cycle.classList.add('is-paused');
    clearInterval(timer);
  }

  nodes.forEach(function(n){
    n.addEventListener('click', function(){
      stop();
      show(parseInt(n.getAttribute('data-stage'), 10), true);
    });
  });
  cycle.addEventListener('mouseenter', stop);
  cycle.addEventListener('mouseleave', start);
  cycle.addEventListener('focusin', stop);
  cycle.addEventListener('focusout', function(e){
    // activeElement is not settled during focusout, so resume on the next tick
    if (!cycle.contains(e.relatedTarget)) setTimeout(start, 0);
  });

  paint(0);
  arcs[0].classList.add('drawn','live');

  // only run while the loop is actually on screen
  if ('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){ e.isIntersecting ? start() : stop(); });
    }, {threshold:0.3}).observe(cycle);
  } else {
    start();
  }
})();

/* ===============================================================
   V23: waitlist form.
   The platform is not live, so every CTA that used to open it now
   lands here. Set WAITLIST_ENDPOINT once a mailing provider is
   chosen; until then the form opens a prefilled mail, so it works
   today and never reports a signup that was not recorded.
   =============================================================== */
(function(){
  var WAITLIST_ENDPOINT = '';                 // e.g. 'https://api.provider.com/v1/subscribe'
  var FALLBACK_TO = 'hello@dolores.id';

  var form = document.getElementById('waitlistForm');
  if (!form) return;
  var input = document.getElementById('wlEmail');
  var note  = document.getElementById('wlNote');

  function say(msg, isError){
    note.textContent = msg;
    note.classList.toggle('err', !!isError);
    note.classList.add('show');
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = input.value.trim();
    // the browser's own email validity check, no hand-rolled regex
    if (!email || !input.checkValidity()){
      input.setAttribute('aria-invalid', 'true');
      say('That does not look like an email address.', true);
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');

    if (!WAITLIST_ENDPOINT){
      window.location.href = 'mailto:' + FALLBACK_TO +
        '?subject=' + encodeURIComponent('Dolores early access') +
        '&body=' + encodeURIComponent('Please add ' + email + ' to the early access list.');
      say('Opening your mail app to confirm.');
      return;
    }

    say('Adding you to the list...');
    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email})
    }).then(function(r){
      if (!r.ok) throw new Error(r.status);
      form.reset();
      say('You are on the list. We will mail you the day agents go live.');
    }).catch(function(){
      say('That did not go through. Mail ' + FALLBACK_TO + ' and we will add you.', true);
    });
  });
})();
