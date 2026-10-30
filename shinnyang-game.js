/* 신냥이의 한 시간 — 활동 연혁용 독립 테스트 게임 (서버/외부 라이브러리/영상 DB 요청 없음) */
(() => {
  'use strict';
  const trigger = document.getElementById('shinnyangTrigger');
  const panel = document.getElementById('shinnyangGame');
  if (!trigger || !panel) return;

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'pilsae:shinnyang:prototype:v1';
  // 실제 활동연혁의 날짜 확정 행 중 일부를 그대로 발췌. 고양이 성장 규칙은 창작입니다.
  const HISTORY_MOMENTS = [{"id":"history:s001","date":"1998-03-24","title":"KMTV 쇼! 뮤직탱크 데뷔 무대","category":"방송","source":"","status":"partial"},{"id":"sheet:99!2","date":"1999-04-15","title":"정규 2집 <T.O.P.(Twinkling of Paradise)> 발매","category":"음반·발매","source":"https://music.bugs.co.kr/album/4247","status":"partial"},{"id":"history:s011","date":"2000-05-27","title":"정규 3집 Only One 발매","category":"음반·발매","source":"https://music.bugs.co.kr/album/4249","status":"partial"},{"id":"history:s015","date":"2001-01-13","title":"첫 단독 콘서트 First Mythology — 1일 차","category":"콘서트","source":"","status":"original_record"},{"id":"history:s022","date":"2002-03-29","title":"정규 5집 Perfect Man 발매","category":"음반·발매","source":"","status":"original_record"},{"id":"new261028:2003-08-28:migliore-5th-concert","date":"2003-08-28","title":"밀리오레 개점 5주년 기념 콘서트 — 신화 출연 (올림픽공원 평화의 광장)","category":"공연","source":"https://www.ktnews.com/news/articleView.html?idxno=37985&replyAll=&reply_sc_order_by=C","status":"partial"},{"id":"history:s042","date":"2005-05-06","title":"신혜성 솔로 1집 오월지련 발매","category":"음반·발매","source":"","status":"partial"},{"id":"history:p0167","date":"2005-05-07","title":"신혜성 솔로 1집 《오월지련》 쇼케이스","category":"음반·발매","source":"","status":"original_record"},{"id":"history:p0219","date":"2008-02-28","title":"신혜성·린 프로젝트 앨범 그 남자 그 여자 이야기","category":"음반·발매","source":"","status":"original_record"},{"id":"cu23:audit-006","date":"2010-02-20","title":"신혜성 일본 쇼케이스 Find Voice In Song — 오사카 Zepp","category":"쇼케이스","source":"https://jp.yna.co.kr/view/AJP20100105001600882","status":"partial"},{"id":"release:2012-03-23-shinhwa10","date":"2012-03-23","title":"신화 정규 10집 《THE RETURN》 발매","category":"음반·발매","source":"https://music.bugs.co.kr/album/324760","status":"partial"}];
  function buildMomentCard() {
    const host = panel.querySelector('.shinnyang-main');
    if (!host || document.getElementById('shinnyangArchiveMoment')) return;
    const box = document.createElement('div');
    box.id = 'shinnyangArchiveMoment';
    box.className = 'shinnyang-moment';
    const heading = document.createElement('div');
    heading.className = 'shinnyang-moment-heading';
    heading.textContent = '✧ 실제 활동 연혁 속 기억';
    const date = document.createElement('div');
    date.className = 'shinnyang-moment-date';
    date.id = 'shinnyangMomentDate';
    const title = document.createElement('div');
    title.className = 'shinnyang-moment-title';
    title.id = 'shinnyangMomentTitle';
    const source = document.createElement('a');
    source.className = 'shinnyang-moment-source';
    source.id = 'shinnyangMomentSource';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = '자료 근거 보기 ↗';
    const note = document.createElement('div');
    note.className = 'shinnyang-moment-note';
    note.textContent = '연혁 원자료 일부 · 독립 검증 상태는 항목마다 다름';
    box.append(heading, date, title, source, note);
    host.appendChild(box);
    const ticker = panel.querySelector('.shinnyang-marquee span');
    if (ticker) ticker.textContent = HISTORY_MOMENTS.map(m => `✧ ${m.date.replace(/-/g,'.')} ${m.title}`).join('　　');
  }
  function renderMoment() {
    const i = (state.sessions * 6 + Math.floor(state.minute / 10)) % HISTORY_MOMENTS.length;
    const item = HISTORY_MOMENTS[i];
    const date = $('shinnyangMomentDate');
    if (!date) return;
    date.textContent = item.date.replace(/-/g, '.') + ' · ' + item.category;
    $('shinnyangMomentTitle').textContent = item.title;
    const link = $('shinnyangMomentSource');
    if (item.source) { link.href = item.source; link.hidden = false; }
    else { link.removeAttribute('href'); link.hidden = true; }
  }

  const LEVELS = [
    { min: 0, title: 'LEVEL 1 · 꼬마냥', outfit: '작은 리본' },
    { min: 40, title: 'LEVEL 2 · 데뷔냥', outfit: '데뷔 스카프' },
    { min: 100, title: 'LEVEL 3 · 무대냥', outfit: '반짝 무대 의상' },
    { min: 190, title: 'LEVEL 4 · 스타냥', outfit: '별빛 왕관' }
  ];
  const initial = () => ({ minute: 0, energy: 70, voice: 20, fans: 0, stars: 0, sessions: 0, scene: 'idle', finished: false, message: '오늘은 어떤 노래를 연습해볼까냥? ♡', notice: '행동을 선택하면 게임 속 10분이 흘러요' });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const cleanNum = (n, max) => Number.isFinite(n) ? clamp(Math.trunc(n), 0, max) : 0;
  function readState() {
    const base = initial();
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) return base;
      const minute = cleanNum(Number(v.minute), 60);
      return {
        ...base,
        minute: Math.floor(minute / 10) * 10,
        energy: cleanNum(Number(v.energy), 100),
        voice: cleanNum(Number(v.voice), 100),
        fans: cleanNum(Number(v.fans), 100),
        stars: cleanNum(Number(v.stars), 999999),
        sessions: cleanNum(Number(v.sessions), 999999),
        scene: ['idle', 'sing', 'rest', 'stage'].includes(v.scene) ? v.scene : 'idle',
        finished: minute === 60,
        message: typeof v.message === 'string' && v.message.length < 130 ? v.message : base.message,
        notice: typeof v.notice === 'string' && v.notice.length < 130 ? v.notice : base.notice
      };
    } catch (_) { return base; }
  }
  let state = readState();
  let spriteInterval = null;
  let blink = false;
  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* 비공개 모드 등 저장 불가 시 현재 화면에서 계속 플레이 */ } }
  function levelIndex() {
    for (let i = LEVELS.length - 1; i >= 0; i--) if (state.stars >= LEVELS[i].min) return i;
    return 0;
  }
  function setBar(id, amount) { $(id).style.width = `${amount}%`; }
  function updateSpriteAlt() {
    const pose = state.scene === 'rest' ? '잠든' : state.scene === 'stage' ? '마이크를 든' : state.scene === 'sing' ? '노래하는' : '서 있는';
    $('shinnyangSprite').setAttribute('aria-label', `${LEVELS[levelIndex()].title}, ${pose} 도트 고양이 신냥이`);
  }
  function render() {
    const level = LEVELS[levelIndex()];
    $('shinnyangRank').textContent = level.title;
    $('shinnyangClock').textContent = `${state.minute === 60 ? '01:00' : '00:' + String(state.minute).padStart(2, '0')} / 01:00`;
    $('shinnyangScene').dataset.scene = state.scene;
    $('shinnyangSceneTag').textContent = state.scene === 'stage' ? '✦ 두근두근 첫 무대' : state.scene === 'rest' ? '☾ 보송보송 낮잠 시간' : '1998 · 첫 연습실';
    $('shinnyangDialogue').textContent = state.message;
    $('shinnyangToast').textContent = state.notice;
    $('snEnergy').textContent = state.energy;
    $('snVoice').textContent = state.voice;
    $('snFans').textContent = state.fans;
    setBar('snEnergyBar', state.energy);
    setBar('snVoiceBar', state.voice);
    setBar('snFansBar', state.fans);
    $('shinnyangStars').textContent = `${state.stars.toLocaleString('ko-KR')} 별 · ${state.sessions}회 완주`;
    [...$('shinnyangProgress').children].forEach((el, i) => el.classList.toggle('filled', i < state.minute / 10));
    const singing = panel.querySelector('[data-sn-act="sing"]');
    const stage = panel.querySelector('[data-sn-act="stage"]');
    const rest = panel.querySelector('[data-sn-act="rest"]');
    singing.disabled = state.finished || state.energy < 14;
    stage.disabled = state.finished || state.energy < 22 || state.voice < 30;
    rest.disabled = state.finished;
    singing.title = singing.disabled && !state.finished ? '체력이 14 이상 필요해요' : '체력 -14, 실력 +20, 인기 +3';
    stage.title = stage.disabled && !state.finished ? '체력 22 이상, 노래 실력 30 이상 필요해요' : '체력 -22, 실력 -3, 인기 +25';
    rest.title = '체력 +25';
    $('shinnyangFinale').setAttribute('aria-hidden', String(!state.finished));
    $('shinnyangActions').hidden = state.finished;
    if (state.finished) {
      $('shinnyangEndTitle').textContent = state.fans >= 50 ? '✦ 반짝이는 무대 성공!' : state.fans >= 25 ? '♡ 첫 번째 박수, 받았다냥!' : '✧ 오늘도 한 뼘 자랐어!';
      $('shinnyangEndBody').textContent = `신냥이는 1시간 동안 실력 ${state.voice} · 인기 ${state.fans}을(를) 모았어. ${level.outfit} 해금 단계까지 성장했어!`;
    }
    updateSpriteAlt();
    renderMoment();
    drawCat();
  }
  function bumpToast() {
    const toast = $('shinnyangToast');
    toast.classList.remove('sn-pop');
    void toast.offsetWidth;
    toast.classList.add('sn-pop');
  }
  function act(kind) {
    if (state.finished) return;
    const oldLevel = levelIndex();
    if (kind === 'sing') {
      if (state.energy < 14) return;
      state.energy -= 14; state.voice = clamp(state.voice + 20, 0, 100); state.fans = clamp(state.fans + 3, 0, 100); state.stars += 9;
      state.message = ['라라라~ ♪ 연습실에 노래가 울려 퍼져냥!', '오늘은 고음도 자신 있다냥~ ♫', '다음 무대를 위해 목을 풀어볼까냥?'][state.minute / 10 % 3];
      state.notice = '♫ 실력 +20 · 체력 -14 · 별 +9';
    } else if (kind === 'rest') {
      state.energy = clamp(state.energy + 25, 0, 100); state.stars += 3;
      state.message = ['쿨쿨… 10분만 더 자고 싶다냥 💤', '담요가 폭신폭신하다냥 ♡', '쉬고 나니 기운이 났어냥!'][state.minute / 10 % 3];
      state.notice = '☾ 체력 +25 · 별 +3';
    } else if (kind === 'stage') {
      if (state.energy < 22 || state.voice < 30) return;
      state.energy -= 22; state.voice = clamp(state.voice - 3, 0, 100); state.fans = clamp(state.fans + 25, 0, 100); state.stars += 17;
      state.message = ['두근두근… 신냥이의 무대 시작! ✦', '냐아아~ ♪ 박수 소리가 들려냥!', '마이크 잡은 발바닥이 반짝! ☆'][state.minute / 10 % 3];
      state.notice = '♥ 인기 +25 · 체력 -22 · 별 +17';
    } else return;
    state.scene = kind;
    state.minute += 10;
    if (state.minute >= 60) {
      state.minute = 60;
      state.finished = true;
      state.sessions += 1;
      state.stars += 10;
      state.notice = '🎀 1시간 완주 보너스 · 별 +10';
    }
    if (levelIndex() > oldLevel) state.notice += ` · ${LEVELS[levelIndex()].title} 성장!`;
    persist(); render(); bumpToast();
  }
  function nextHour() {
    const progress = { stars: state.stars, sessions: state.sessions };
    state = { ...initial(), ...progress, message: '또 한 시간의 작은 이야기를 시작해보자냥! ♡' };
    persist(); render();
    const singButton = panel.querySelector('[data-sn-act="sing"]');
    if (singButton) singButton.focus();
  }
  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? '신냥이 미니게임 닫기' : '신냥이 미니게임 열기');
    if (open) {
      render();
      $('shinnyangClose').focus();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden && !spriteInterval) {
        spriteInterval = window.setInterval(() => { blink = !blink; drawCat(); }, 1350);
      }
    } else {
      if (spriteInterval) { clearInterval(spriteInterval); spriteInterval = null; }
      trigger.focus();
    }
  }
  function drawCat() {
    const canvas = $('shinnyangSprite');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 40, 40);
    const c = { outline: '#7b5e80', fur: '#fff2e7', furShadow: '#edd8d1', inside: '#f2b9c6', cheek: '#f8a8b5', dark: '#53475c', lilac: '#b99ddd', ribbon: '#d6a0c4', white: '#fffefa', gold: '#f5c96c', mic: '#8f8198', micLight: '#ded4df' };
    const px = (x, y, w, h, color) => { ctx.fillStyle = c[color] || color; ctx.fillRect(x, y, w, h); };
    // 꼬리와 몸통을 먼저 그립니다. 외부 이미지 리소스가 필요 없습니다.
    px(28, 27, 5, 3, 'outline'); px(32, 23, 3, 6, 'outline'); px(33, 20, 3, 5, 'outline');
    px(29, 27, 3, 2, 'furShadow'); px(33, 23, 1, 4, 'fur'); px(34, 21, 1, 2, 'fur');
    px(13, 24, 15, 10, 'outline'); px(12, 27, 17, 5, 'outline');
    px(14, 24, 13, 9, 'furShadow'); px(15, 25, 11, 8, 'fur');
    px(12, 30, 5, 5, 'outline'); px(24, 30, 5, 5, 'outline');
    px(13, 30, 4, 4, 'fur'); px(24, 30, 4, 4, 'fur');
    px(14, 35, 5, 1, 'furShadow'); px(23, 35, 5, 1, 'furShadow');
    // 가수냥 의상은 누적 성장 별 수에 따라 추가됩니다.
    const level = levelIndex();
    if (level >= 1) { px(17, 25, 8, 2, 'lilac'); px(18, 27, 6, 4, 'lilac'); px(20, 27, 2, 2, 'white'); }
    if (level >= 2) { px(14, 27, 2, 2, 'gold'); px(26, 27, 2, 2, 'gold'); px(20, 29, 2, 2, 'gold'); }
    // 귀 (폭신한 윤곽과 분홍색 귀 속).
    px(9, 6, 3, 11, 'outline'); px(10, 5, 3, 9, 'outline'); px(11, 4, 3, 9, 'outline');
    px(28, 6, 3, 11, 'outline'); px(27, 5, 3, 9, 'outline'); px(26, 4, 3, 9, 'outline');
    px(11, 7, 3, 7, 'fur'); px(26, 7, 3, 7, 'fur'); px(12, 8, 2, 5, 'inside'); px(26, 8, 2, 5, 'inside');
    // 둥근 머리 및 얼굴.
    px(13, 8, 14, 2, 'outline'); px(10, 10, 20, 3, 'outline'); px(8, 13, 24, 10, 'outline');
    px(10, 23, 20, 3, 'outline'); px(13, 26, 14, 2, 'outline');
    px(13, 10, 14, 1, 'fur'); px(11, 11, 18, 3, 'fur'); px(9, 14, 22, 9, 'fur');
    px(11, 23, 18, 2, 'fur'); px(14, 25, 12, 2, 'fur');
    px(11, 19, 5, 3, 'furShadow'); px(25, 19, 5, 3, 'furShadow');
    px(12, 19, 3, 2, 'cheek'); px(26, 19, 3, 2, 'cheek');
    // 표정: 낮잠·눈 깜빡임·노래·기본.
    const asleep = state.scene === 'rest';
    if (asleep || blink) {
      px(14, 17, 4, 1, 'dark'); px(23, 17, 4, 1, 'dark');
    } else {
      px(15, 16, 2, 3, 'dark'); px(24, 16, 2, 3, 'dark');
      px(15, 16, 1, 1, 'white'); px(24, 16, 1, 1, 'white');
    }
    px(20, 19, 2, 1, 'ribbon');
    if (state.scene === 'sing' || state.scene === 'stage') { px(20, 21, 2, 3, 'dark'); px(20, 23, 2, 1, 'inside'); }
    else { px(18, 21, 2, 1, 'dark'); px(22, 21, 2, 1, 'dark'); }
    // 작은 양손, 리본, 무대 마이크.
    px(12, 27, 3, 4, 'outline'); px(13, 28, 2, 2, 'fur'); px(27, 27, 3, 4, 'outline'); px(27, 28, 2, 2, 'fur');
    px(17, 26, 4, 3, 'ribbon'); px(21, 26, 4, 3, 'ribbon'); px(20, 27, 2, 2, 'gold');
    if (level === 3) { px(18, 5, 7, 2, 'gold'); px(18, 2, 2, 4, 'gold'); px(21, 3, 2, 3, 'gold'); px(24, 2, 2, 4, 'gold'); }
    if (state.scene === 'stage') {
      px(30, 15, 5, 6, 'mic'); px(31, 16, 3, 3, 'micLight'); px(32, 21, 1, 11, 'outline'); px(31, 31, 3, 2, 'mic');
      px(27, 24, 4, 3, 'fur');
    }
    if (asleep) { px(34, 8, 2, 1, 'lilac'); px(36, 6, 2, 1, 'lilac'); px(35, 4, 2, 1, 'lilac'); }
  }
  trigger.addEventListener('click', () => setOpen(panel.hidden));
  $('shinnyangClose').addEventListener('click', () => setOpen(false));
  panel.querySelectorAll('[data-sn-act]').forEach(button => button.addEventListener('click', () => act(button.dataset.snAct)));
  $('shinnyangAgain').addEventListener('click', nextHour);
  $('shinnyangReset').addEventListener('click', () => {
    if (!window.confirm('신냥이의 성장 기록을 처음부터 다시 시작할까요?')) return;
    state = initial(); persist(); render();
  });
  document.addEventListener('keydown', event => {
    if (!panel.hidden && event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && spriteInterval) { clearInterval(spriteInterval); spriteInterval = null; }
    else if (!document.hidden && !panel.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !spriteInterval) {
      spriteInterval = window.setInterval(() => { blink = !blink; drawCat(); }, 1350);
    }
  });
  buildMomentCard();
  render();
})();
