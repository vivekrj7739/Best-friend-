(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const finaleEl = document.getElementById('finale');
  const hintEl = document.getElementById('hint');
  const titleEl = document.getElementById('title');
  const letterBtn = document.getElementById('letterBtn');
  const letterModal = document.getElementById('letterModal');
  const closeLetter = document.querySelector('.close-letter');
  
  letterBtn.addEventListener('click', () => {
    letterModal.classList.add('open');
  });
  closeLetter.addEventListener('click', () => {
    letterModal.classList.remove('open');
  });
  letterModal.addEventListener('click', (e) => {
    if (e.target === letterModal) letterModal.classList.remove('open');
  });

  document.getElementById('heartCanvas').style.display = 'none';

  let W, H, dpr;

  let merged = false, mergeTime = 0, lastBeatT = 0, lastInteract = 0;
  let separating = false, separateStart = 0;
  const mergeLock = { x: 0, y: 0 };
  let tiltX = 0, tiltY = 0;
  let heartProgress = 0, heartFill = 0;
  let heartScale = 0;

  const soulA = {
    x: 0, y: 0, tx: 0, ty: 0, radius: 20, isDragging: false, touchId: null,
    r: 255, g: 105, b: 180, scaredVx: 0, scaredVy: 0, scared: false
  };
  const soulB = {
    x: 0, y: 0, tx: 0, ty: 0, radius: 20, isDragging: false, touchId: null,
    r: 255, g: 60, b: 60, scaredVx: 0, scaredVy: 0, scared: false
  };

  const HEART_RES = 256;
  const hpx = new Float32Array(HEART_RES);
  const hpy = new Float32Array(HEART_RES);

  function buildHeartPts() {
    for (let i = 0; i < HEART_RES; i++) {
      const t = (i / HEART_RES) * Math.PI * 2;
      hpx[i] = 16 * Math.pow(Math.sin(t), 3);
      hpy[i] = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    }
  }

  function computeHeartScale(now) {
    const base = (Math.min(W, H) * 0.38) / 32;
    const cycle = (now * 0.0013) % 1;
    let pulse = 0;
    if (cycle < 0.12) pulse = Math.sin((cycle / 0.12) * Math.PI);
    else if (cycle > 0.18 && cycle < 0.35) pulse = 0.5 * Math.sin(((cycle - 0.18) / 0.17) * Math.PI);
    return base * (1 + pulse * 0.12);
  }

  const NS = 160;
  const stX = new Float32Array(NS), stY = new Float32Array(NS),
    stR = new Float32Array(NS), stSp = new Float32Array(NS),
    stOf = new Float32Array(NS), stPr = new Float32Array(NS);
  function initStars() {
    for (let i = 0; i < NS; i++) {
      stX[i] = Math.random() * W; stY[i] = Math.random() * H;
      stR[i] = Math.random() * .9 + .2; stSp[i] = Math.random() * .01 + .003;
      stOf[i] = Math.random() * 6.28; stPr[i] = Math.random() * .25 + .05;
    }
  }
  function drawStars(t) {
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .55; ctx.beginPath();
    for (let i = 0; i < NS; i++) {
      const tw = Math.sin(t * stSp[i] * 60 + stOf[i]) * .22 + .78;
      const px = stX[i] + tiltX * stPr[i], py = stY[i] + tiltY * stPr[i];
      const rr = stR[i] * tw;
      ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, 6.2832);
    }
    ctx.fill(); ctx.globalAlpha = 1;
  }


  const N = 350, F = 10;
  const pA = new Float32Array(N * F), pB = new Float32Array(N * F);
  const ptBuf = new Float32Array(N * 3);

  function resetP(arr, i, ox, oy) {
    const o = i * F, a = Math.random() * 6.2832, r = Math.random() * 38 + 8;
    arr[o] = ox + Math.cos(a) * r; arr[o + 1] = oy + Math.sin(a) * r;
    arr[o + 2] = (Math.random() - .5) * .55; arr[o + 3] = (Math.random() - .5) * .55;
    arr[o + 4] = Math.random() * .5 + .5; arr[o + 5] = Math.random() * .0038 + .002;
    arr[o + 6] = Math.random() * 1.3 + .35;
    arr[o + 7] = Math.random() * 6.2832; arr[o + 8] = Math.random() * 36 + 8;
    arr[o + 9] = (Math.random() - .5) * .013;
  }
  function initParticles() {
    for (let i = 0; i < N; i++) { resetP(pA, i, soulA.x, soulA.y); resetP(pB, i, soulB.x, soulB.y); }
  }

  function updateDrawParticles(heartActive, cx, cy, hs) {
    ctx.globalCompositeOperation = 'screen';
    // A — violet
    let c = 0;
    for (let i = 0; i < N; i++) {
      const o = i * F; let vx = pA[o + 2], vy = pA[o + 3];
      if (heartActive) {
        const hi = (i * 7) & (HEART_RES - 1);
        vx += (cx + hpx[hi] * hs - pA[o]) * .009; vy += (cy + hpy[hi] * hs - pA[o + 1]) * .009;
      } else {
        pA[o + 7] += pA[o + 9];
        vx += (soulA.x + Math.cos(pA[o + 7]) * pA[o + 8] - pA[o]) * .04;
        vy += (soulA.y + Math.sin(pA[o + 7]) * pA[o + 8] - pA[o + 1]) * .04;
      }
      pA[o + 2] = vx * .88; pA[o + 3] = vy * .88; pA[o] += pA[o + 2]; pA[o + 1] += pA[o + 3];
      pA[o + 4] -= pA[o + 5];
      if (pA[o + 4] <= 0) { resetP(pA, i, soulA.x, soulA.y); continue; }
      ptBuf[c * 3] = pA[o]; ptBuf[c * 3 + 1] = pA[o + 1]; ptBuf[c * 3 + 2] = pA[o + 6]; c++;
    }
    ctx.fillStyle = 'rgba(255,105,180,.8)'; ctx.beginPath();
    for (let i = 0; i < c; i++) { const r = ptBuf[i * 3 + 2]; ctx.moveTo(ptBuf[i * 3] + r, ptBuf[i * 3 + 1]); ctx.arc(ptBuf[i * 3], ptBuf[i * 3 + 1], r, 0, 6.2832); }
    ctx.fill();
    // B — rose
    c = 0;
    for (let i = 0; i < N; i++) {
      const o = i * F; let vx = pB[o + 2], vy = pB[o + 3];
      if (heartActive) {
        const hi = ((i + 128) * 7) & (HEART_RES - 1);
        vx += (cx + hpx[hi] * hs - pB[o]) * .009; vy += (cy + hpy[hi] * hs - pB[o + 1]) * .009;
      } else {
        pB[o + 7] += pB[o + 9];
        vx += (soulB.x + Math.cos(pB[o + 7]) * pB[o + 8] - pB[o]) * .04;
        vy += (soulB.y + Math.sin(pB[o + 7]) * pB[o + 8] - pB[o + 1]) * .04;
      }
      pB[o + 2] = vx * .88; pB[o + 3] = vy * .88; pB[o] += pB[o + 2]; pB[o + 1] += pB[o + 3];
      pB[o + 4] -= pB[o + 5];
      if (pB[o + 4] <= 0) { resetP(pB, i, soulB.x, soulB.y); continue; }
      ptBuf[c * 3] = pB[o]; ptBuf[c * 3 + 1] = pB[o + 1]; ptBuf[c * 3 + 2] = pB[o + 6]; c++;
    }
    ctx.fillStyle = 'rgba(255,60,60,.8)'; ctx.beginPath();
    for (let i = 0; i < c; i++) { const r = ptBuf[i * 3 + 2]; ctx.moveTo(ptBuf[i * 3] + r, ptBuf[i * 3 + 1]); ctx.arc(ptBuf[i * 3], ptBuf[i * 3 + 1], r, 0, 6.2832); }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const MN = 14;
  const nX = new Float32Array(MN), nY = new Float32Array(MN),
    nVX = new Float32Array(MN), nVY = new Float32Array(MN),
    nR = new Float32Array(MN), nAl = new Float32Array(MN),
    nD = new Float32Array(MN), nHue = new Uint8Array(MN);
  let nebN = 0;
  function spawnNebulas(x, y) {
    for (let i = 0; i < MN; i++) {
      nX[i] = x; nY[i] = y;
      nVX[i] = (Math.random() - .5) * 3; nVY[i] = (Math.random() - .5) * 3 - 1;
      nR[i] = Math.random() * 50 + 20; nAl[i] = .22;
      nD[i] = Math.random() * .004 + .002; nHue[i] = Math.random() > .5 ? 1 : 0;
    }
    nebN = MN;
  }
  function drawNebulas() {
    if (!nebN) return;
    ctx.globalCompositeOperation = 'screen';
    let alive = 0;
    for (let i = 0; i < nebN; i++) {
      nX[i] += nVX[i]; nY[i] += nVY[i]; nVX[i] *= .99; nVY[i] *= .99;
      nR[i] += .35; nAl[i] -= nD[i];
      if (nAl[i] <= 0) continue;
      if (alive < i) {
        nX[alive] = nX[i]; nY[alive] = nY[i]; nVX[alive] = nVX[i]; nVY[alive] = nVY[i];
        nR[alive] = nR[i]; nAl[alive] = nAl[i]; nD[alive] = nD[i]; nHue[alive] = nHue[i];
      }
      const g = ctx.createRadialGradient(nX[alive], nY[alive], 0, nX[alive], nY[alive], nR[alive]);
      g.addColorStop(0, `hsla(${nHue[alive] ? 350 : 10},100%,72%,${nAl[alive].toFixed(3)})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.beginPath(); ctx.arc(nX[alive], nY[alive], nR[alive], 0, 6.2832);
      ctx.fillStyle = g; ctx.fill(); alive++;
    }
    nebN = alive;
    ctx.globalCompositeOperation = 'source-over';
  }

  const MFH = 50;
  const fX = new Float32Array(MFH), fY = new Float32Array(MFH),
    fVX = new Float32Array(MFH), fVY = new Float32Array(MFH),
    fS = new Float32Array(MFH), fA = new Float32Array(MFH),
    fD = new Float32Array(MFH), fC = new Uint8Array(MFH);
  let fhN = 0;
  function spawnFH(x, y, count) {
    for (let i = 0; i < count && fhN < MFH; i++, fhN++) {
      fX[fhN] = x; fY[fhN] = y;
      fVX[fhN] = (Math.random() - .5) * 4; fVY[fhN] = -Math.random() * 5 - 1.5;
      fS[fhN] = Math.random() * 9 + 4; fA[fhN] = 1;
      fD[fhN] = Math.random() * .013 + .007; fC[fhN] = Math.random() > .5 ? 1 : 0;
    }
  }
  function drawHeartShape(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y - s * .25);
    ctx.bezierCurveTo(x - s * .5, y - s * .75, x - s, y - s * .33, x - s, y);
    ctx.bezierCurveTo(x - s, y + s * .5, x - s * .33, y + s * .83, x, y + s);
    ctx.bezierCurveTo(x + s * .33, y + s * .83, x + s, y + s * .5, x + s, y);
    ctx.bezierCurveTo(x + s, y - s * .33, x + s * .5, y - s * .75, x, y - s * .25);
    ctx.closePath(); ctx.fill();
  }
  function drawFH() {
    let alive = 0;
    for (let i = 0; i < fhN; i++) {
      fX[i] += fVX[i]; fY[i] += fVY[i]; fVX[i] *= .96; fVY[i] *= .97; fA[i] -= fD[i];
      if (fA[i] <= 0) continue;
      if (alive < i) {
        fX[alive] = fX[i]; fY[alive] = fY[i]; fVX[alive] = fVX[i]; fVY[alive] = fVY[i];
        fS[alive] = fS[i]; fA[alive] = fA[i]; fD[alive] = fD[i]; fC[alive] = fC[i];
      }
      ctx.globalAlpha = fA[alive];
      drawHeartShape(fX[alive], fY[alive], fS[alive], fC[alive] ? '#ff1493' : '#ff0000');
      alive++;
    }
    fhN = alive; ctx.globalAlpha = 1;
  }

  const MSW = 3;
  const swX = new Float32Array(MSW), swY = new Float32Array(MSW),
    swR = new Float32Array(MSW), swA = new Float32Array(MSW), swMR = new Float32Array(MSW);
  let swN = 0;
  function spawnSW(x, y, maxR, a) {
    if (swN >= MSW) return;
    swX[swN] = x; swY[swN] = y; swR[swN] = 0; swA[swN] = a; swMR[swN] = maxR; swN++;
  }
  function drawSW() {
    if (!swN) return;
    let alive = 0;
    for (let i = 0; i < swN; i++) {
      swR[i] += swMR[i] * .043; swA[i] -= .025;
      if (swA[i] <= 0) continue;
      if (alive < i) { swX[alive] = swX[i]; swY[alive] = swY[i]; swR[alive] = swR[i]; swA[alive] = swA[i]; swMR[alive] = swMR[i]; }
      ctx.beginPath(); ctx.arc(swX[alive], swY[alive], swR[alive], 0, 6.2832);
      ctx.strokeStyle = `rgba(255,200,240,${swA[alive].toFixed(3)})`;
      ctx.lineWidth = 2; ctx.stroke(); alive++;
    }
    swN = alive;
  }

  const MP = 25;
  const pX = new Float32Array(MP), pY = new Float32Array(MP),
        pVX = new Float32Array(MP), pVY = new Float32Array(MP),
        pS = new Float32Array(MP), petalA = new Float32Array(MP),
        pRot = new Float32Array(MP), pRS = new Float32Array(MP);
  let pN = 0;

  function spawnPetal() {
    if (pN >= MP) return;
    pX[pN] = Math.random() * W; pY[pN] = -20;
    pVX[pN] = (Math.random() - 0.5) * 2; pVY[pN] = Math.random() * 2 + 1;
    pS[pN] = Math.random() * 6 + 6; petalA[pN] = Math.random() * 6.28;
    pRot[pN] = Math.random() * 6.28; pRS[pN] = (Math.random() - 0.5) * 0.1;
    pN++;
  }

  function drawPetals() {
    let alive = 0;
    for (let i = 0; i < pN; i++) {
      pX[i] += pVX[i] + Math.sin(petalA[i]) * 0.5; pY[i] += pVY[i];
      petalA[i] += 0.02; pRot[i] += pRS[i];
      if (pY[i] > H + 20) continue;
      if (alive !== i) {
        pX[alive] = pX[i]; pY[alive] = pY[i]; pVX[alive] = pVX[i]; pVY[alive] = pVY[i];
        pS[alive] = pS[i]; petalA[alive] = petalA[i]; pRot[alive] = pRot[i]; pRS[alive] = pRS[i];
      }
      ctx.save();
      ctx.translate(pX[alive], pY[alive]); ctx.rotate(pRot[alive]); ctx.scale(1, Math.abs(Math.sin(petalA[alive])));
      ctx.fillStyle = '#ff1493'; ctx.shadowColor = 'rgba(255,20,100,0.5)'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.moveTo(0, -pS[alive]);
      ctx.quadraticCurveTo(pS[alive], -pS[alive], pS[alive], 0);
      ctx.quadraticCurveTo(pS[alive], pS[alive], 0, pS[alive]);
      ctx.quadraticCurveTo(-pS[alive], pS[alive], -pS[alive], 0);
      ctx.quadraticCurveTo(-pS[alive], -pS[alive], 0, -pS[alive]);
      ctx.fill(); ctx.restore();
      alive++;
    }
    pN = alive;
  }

  function drawBigHeart(cx, cy, hs, progress, fill, now) {
    if (progress <= 0) return;

    const maxMult = Math.min(W, H) * 0.88 / (32 * hs);
    const BM = Math.min(1.9, maxMult);
    const s = hs * BM;
    const pts = Math.min(HEART_RES, (progress * HEART_RES + 1) | 0);

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(hpx[0] * s, hpy[0] * s);
    for (let i = 1; i < pts; i++) ctx.lineTo(hpx[i] * s, hpy[i] * s);
    if (progress >= .99) ctx.closePath();

    // Pulsing white stroke
    if (fill > 0) {
      const fillPulse = Math.sin(now * .005) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(220, 20, 60, ${fill * fillPulse})`;
      ctx.fill();
    }

    const strokeAlpha = progress >= .99
      ? 0.7 + Math.sin(now * .003) * .3
      : 0.8;
    ctx.strokeStyle = `rgba(255,100,100,${strokeAlpha.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 0, 0, 1)';
    ctx.shadowBlur = 25;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hpx[0] * s, hpy[0] * s);
    for (let i = 1; i < pts; i++) ctx.lineTo(hpx[i] * s, hpy[i] * s);
    if (progress >= .99) ctx.closePath();
    const glowGrad = ctx.createLinearGradient(-s * 16, 0, s * 16, 0);
    glowGrad.addColorStop(0, 'rgba(255,0,0,.8)');
    glowGrad.addColorStop(.5, 'rgba(255,100,100,.8)');
    glowGrad.addColorStop(1, 'rgba(255,0,0,.8)');
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.restore();
  }

  /*  SOUL GLOW */
  function drawSoul(s, now) {
    const pulse = Math.sin(now * .002) * .1 + .9;
    const x = s.x, y = s.y, r = s.radius;
    const rc = s.r, gc = s.g, bc = s.b;
    const g1 = ctx.createRadialGradient(x, y, 0, x, y, r * 4 * pulse);
    g1.addColorStop(0, `rgba(${rc},${gc},${bc},.15)`);
    g1.addColorStop(1, `rgba(${rc},${gc},${bc},0)`);
    ctx.beginPath(); ctx.arc(x, y, r * 4 * pulse, 0, 6.2832); ctx.fillStyle = g1; ctx.fill();
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    g2.addColorStop(0, 'rgba(255,255,255,.95)');
    g2.addColorStop(.35, `rgba(${rc},${gc},${bc},1)`);
    g2.addColorStop(1, `rgba(${rc},${gc},${bc},0)`);
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 6.2832); ctx.fillStyle = g2; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * .42, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill();
  }

  /*THREAD*/
  function drawThread(now, dist, thr) {
    const op = Math.min(1, (thr - dist) / 60) * .4; if (op <= 0) return;
    ctx.beginPath(); ctx.moveTo(soulA.x, soulA.y);
    const mx = (soulA.x + soulB.x) / 2 + Math.sin(now * .003) * 10;
    const my = (soulA.y + soulB.y) / 2 + Math.cos(now * .003) * 10;
    ctx.quadraticCurveTo(mx, my, soulB.x, soulB.y);
    ctx.strokeStyle = `rgba(255,255,255,${op.toFixed(3)})`;
    ctx.lineWidth = 1.4; ctx.stroke();
  }

  /* RESET */
  function placeSouls() {
    if (W < H) { soulA.x = W * .5; soulA.y = H * .28; soulB.x = W * .5; soulB.y = H * .72; }
    else { soulA.x = W * .28; soulA.y = H * .5; soulB.x = W * .72; soulB.y = H * .5; }
    soulA.tx = soulA.x; soulA.ty = soulA.y; soulB.tx = soulB.x; soulB.ty = soulB.y;
    soulA.scaredVx = 0; soulA.scaredVy = 0; soulA.scared = false;
    soulB.scaredVx = 0; soulB.scaredVy = 0; soulB.scared = false;
  }

  function beginSeparation() {
    if (!merged || separating) return;
    separating = true;
    separateStart = performance.now();
    // Fade out finale text immediately
    finaleEl.classList.remove('visible');
    hintEl.style.opacity = '0';
    document.getElementById('replayBtn').classList.remove('visible');
    letterBtn.classList.remove('visible');
    letterModal.classList.remove('open');
  }
  function finishSeparation() {

    separating = false;
    merged = false;
    heartProgress = 0; heartFill = 0;
    nebN = 0; fhN = 0; swN = 0;

    const cx = mergeLock.x, cy = mergeLock.y;
    if (W < H) {
      soulA.x = cx; soulA.y = cy - H * .2; soulA.tx = soulA.x; soulA.ty = soulA.y;
      soulB.x = cx; soulB.y = cy + H * .2; soulB.tx = soulB.x; soulB.ty = soulB.y;
    } else {
      soulA.x = cx - W * .2; soulA.y = cy; soulA.tx = soulA.x; soulA.ty = soulA.y;
      soulB.x = cx + W * .2; soulB.y = cy; soulB.tx = soulB.x; soulB.ty = soulB.y;
    }
    initParticles();

    hintEl.textContent = 'drag the souls together ✦';
    hintEl.style.opacity = '1';
    titleEl.style.opacity = '1';
  }

  function resetAll() {
    separating = false;
    merged = false; heartProgress = 0; heartFill = 0;
    nebN = 0; fhN = 0; swN = 0;
    finaleEl.classList.remove('visible');
    hintEl.textContent = 'drag the souls together ✦';
    hintEl.style.opacity = '1'; titleEl.style.opacity = '1';
    document.getElementById('replayBtn').classList.remove('visible');
    letterBtn.classList.remove('visible');
    letterModal.classList.remove('open');
    placeSouls(); initParticles();
  }


  function render(now) {
    requestAnimationFrame(render);

    // Dark trail
    ctx.fillStyle = 'rgba(0,0,15,.15)';
    ctx.fillRect(0, 0, W, H);

    drawStars(now);

    heartScale = computeHeartScale(now);

    const idle = now - lastInteract;
    if (idle > 2000 && !soulA.isDragging && !soulB.isDragging && !merged) {
      const t = now * .001;
      if (W < H) {
        soulA.tx = W * .5 + Math.cos(t * .9) * 24; soulA.ty = H * .28 + Math.sin(t * 1.1) * 18;
        soulB.tx = W * .5 - Math.cos(t * .9) * 24; soulB.ty = H * .72 + Math.cos(t * 1.1) * 18;
      } else {
        soulA.tx = W * .28 + Math.cos(t * 1.1) * 24; soulA.ty = H * .5 + Math.sin(t * .9) * 18;
        soulB.tx = W * .72 - Math.cos(t * 1.1) * 24; soulB.ty = H * .5 - Math.sin(t * .9) * 18;
      }
    }


    if (!merged) {
      for (const s of [soulA, soulB]) {
        if (!s.isDragging) {
          s.scaredVx *= .85; s.scaredVy *= .85;
          if (!s.scared) { s.tx += s.scaredVx * .3; s.ty += s.scaredVy * .3; }
        }
      }
    }

    if (separating) {
      const t = Math.min(1, (now - separateStart) / 1200);
      const spread = t * Math.min(W, H) * 0.22;
      const angle = W < H ? Math.PI / 2 : 0;
      const tx1 = mergeLock.x - Math.cos(angle) * spread, ty1 = mergeLock.y - Math.sin(angle) * spread;
      const tx2 = mergeLock.x + Math.cos(angle) * spread, ty2 = mergeLock.y + Math.sin(angle) * spread;
      soulA.x += (tx1 - soulA.x) * .07; soulA.y += (ty1 - soulA.y) * .07;
      soulB.x += (tx2 - soulB.x) * .07; soulB.y += (ty2 - soulB.y) * .07;
    } else if (merged) {
      if (soulA.isDragging) { mergeLock.x = soulA.tx; mergeLock.y = soulA.ty; }
      else if (soulB.isDragging) { mergeLock.x = soulB.tx; mergeLock.y = soulB.ty; }

      const dragging = soulA.isDragging || soulB.isDragging;
      const lf = dragging ? .35 : .07;
      soulA.x += (mergeLock.x - soulA.x) * lf; soulA.y += (mergeLock.y - soulA.y) * lf;
      soulB.x += (mergeLock.x - soulB.x) * lf; soulB.y += (mergeLock.y - soulB.y) * lf;
    } else {
      const lf = .07;
      soulA.x += (soulA.tx - soulA.x) * lf; soulA.y += (soulA.ty - soulA.y) * lf;
      soulB.x += (soulB.tx - soulB.x) * lf; soulB.y += (soulB.ty - soulB.y) * lf;
    }

    const dist = Math.hypot(soulB.x - soulA.x, soulB.y - soulA.y);
    const THR = W < H ? 200 : 210;
    const heartActive = dist < THR;
    const cx = (soulA.x + soulB.x) / 2, cy = (soulA.y + soulB.y) / 2;

    const tdist = Math.hypot(soulB.tx - soulA.tx, soulB.ty - soulA.ty);
    if (!merged && !separating && tdist < 50) {
      merged = true; mergeTime = now;
      mergeLock.x = cx; mergeLock.y = cy;
      soulA.tx = cx; soulA.ty = cy; soulB.tx = cx; soulB.ty = cy;
      spawnNebulas(cx, cy); spawnFH(cx, cy, 22);
      spawnSW(cx, cy, Math.max(W, H) * .72, .82);
      spawnSW(cx, cy, Math.max(W, H) * .46, .42);
      setTimeout(() => {
        finaleEl.classList.add('visible');
        document.getElementById('replayBtn').classList.add('visible');
        hintEl.textContent = 'pull apart with two fingers to separate ✦';
        hintEl.style.opacity = '1';
        
        // Animate the letter button from merging point to bottom
        letterBtn.style.transition = 'none';
        letterBtn.style.left = cx + 'px';
        letterBtn.style.top = cy + 'px';
        letterBtn.style.transform = 'translate(-50%, -50%) scale(0)';
        
        // Force reflow
        void letterBtn.offsetWidth;
        
        // Move to bottom center, above the hint
        letterBtn.style.transition = 'transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), top 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), left 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease';
        letterBtn.style.top = 'calc(100% - 120px)'; // Above hint area
        letterBtn.style.left = '50%';
        letterBtn.classList.add('visible');
      }, 900);
    }

    if (separating) {
      const elapsed = now - separateStart;
      const dur = 1200; // ms to fully unwind
      const t = Math.min(1, elapsed / dur);
      heartProgress = Math.max(0, 1 - t);
      heartFill = Math.max(0, heartFill - 0.02);
      if (t >= 1) finishSeparation();
    } else if (merged) {
      const el = now - mergeTime;
      if (el > 400) heartProgress = Math.min(1, (el - 400) / 1500);
      if (heartProgress >= .99) heartFill = Math.min(1, heartFill + .008);
    }
    if ((merged || separating) && heartProgress > 0) {
      drawBigHeart(cx, cy, heartScale, heartProgress, heartFill, now);
    }

    drawSW();
    if (heartActive && !merged) drawThread(now, dist, THR);
    drawNebulas();
    updateDrawParticles(heartActive, cx, cy, heartScale);
    drawFH();

    if (merged && !separating && now - lastBeatT > 700) { lastBeatT = now; spawnFH(cx, cy, 2); }
    if (merged && Math.random() > 0.9) spawnPetal();

    drawPetals();

    ctx.globalCompositeOperation = 'screen';
    drawSoul(soulA, now); drawSoul(soulB, now);
    ctx.globalCompositeOperation = 'source-over';

    if (!merged) {
      const fs = Math.max(12, Math.min(16, W * .038));
      ctx.save();
      ctx.font = `300 ${fs}px Inter,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      // YOU
      const yOff = soulA.radius + fs + 6;
      ctx.shadowColor = 'rgba(255,105,180,1)'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255,105,180,.95)';
      ctx.fillText('YOU', soulA.x, soulA.y - yOff);
      // ME
      const mOff = soulB.radius + fs + 6;
      ctx.shadowColor = 'rgba(255,60,60,1)'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255,60,60,.95)';
      ctx.fillText('ME', soulB.x, soulB.y - mOff);
      ctx.restore();
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#00000f'; ctx.fillRect(0, 0, W, H);
    buildHeartPts(); initStars();
    if (!merged) { placeSouls(); initParticles(); }
  }

  function shy(s, px, py) {
    if (merged) return;
    const d = Math.hypot(s.x - px, s.y - py);
    if (d < 80) { const a = Math.atan2(s.y - py, s.x - px); s.scaredVx += Math.cos(a) * .8; s.scaredVy += Math.sin(a) * .8; s.scared = true; }
    else s.scared = false;
  }

  const LIFT = -44;
  function tp(t) { const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault(); lastInteract = performance.now();
    if (merged) {
      for (const t of e.changedTouches) {
        const p = tp(t);
        if (e.touches.length >= 2) {
          if (soulA.touchId === null) {
            soulA.isDragging = true; soulA.touchId = t.identifier;
            soulA.tx = p.x; soulA.ty = p.y + LIFT;
          } else if (soulB.touchId === null) {
            soulB.isDragging = true; soulB.touchId = t.identifier;
            soulB.tx = p.x; soulB.ty = p.y + LIFT;
          }
        } else {
          if (soulA.touchId === null) {
            soulA.isDragging = true; soulA.touchId = t.identifier;
            soulA.tx = p.x; soulA.ty = p.y + LIFT;
            soulB.tx = p.x; soulB.ty = p.y + LIFT;
            mergeLock.x = p.x; mergeLock.y = p.y + LIFT;
          }
        }
      }
      return;
    }
    for (const t of e.changedTouches) {
      const p = tp(t);
      const dA = Math.hypot(soulA.x - p.x, soulA.y - p.y), dB = Math.hypot(soulB.x - p.x, soulB.y - p.y);
      if (dA < dB) {
        if (dA < 90 && soulA.touchId === null) { soulA.isDragging = true; soulA.touchId = t.identifier; soulA.tx = p.x; soulA.ty = p.y + LIFT; }
        else if (dB < 90 && soulB.touchId === null) { soulB.isDragging = true; soulB.touchId = t.identifier; soulB.tx = p.x; soulB.ty = p.y + LIFT; }
      } else {
        if (dB < 90 && soulB.touchId === null) { soulB.isDragging = true; soulB.touchId = t.identifier; soulB.tx = p.x; soulB.ty = p.y + LIFT; }
        else if (dA < 90 && soulA.touchId === null) { soulA.isDragging = true; soulA.touchId = t.identifier; soulA.tx = p.x; soulA.ty = p.y + LIFT; }
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault(); lastInteract = performance.now();
    const twoFinger = merged && e.touches.length >= 2 && soulA.isDragging && soulB.isDragging;
    for (const t of e.touches) {
      const p = tp(t);
      if (soulA.isDragging && soulA.touchId === t.identifier) {
        soulA.tx = p.x; soulA.ty = p.y + LIFT;

        if (merged && !twoFinger) { soulB.tx = p.x; soulB.ty = p.y + LIFT; mergeLock.x = p.x; mergeLock.y = p.y + LIFT; }
      }
      if (soulB.isDragging && soulB.touchId === t.identifier) {
        soulB.tx = p.x; soulB.ty = p.y + LIFT;
        if (merged && !twoFinger) { soulA.tx = p.x; soulA.ty = p.y + LIFT; mergeLock.x = p.x; mergeLock.y = p.y + LIFT; }
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (soulA.touchId === t.identifier) { soulA.isDragging = false; soulA.touchId = null; }
      if (soulB.touchId === t.identifier) { soulB.isDragging = false; soulB.touchId = null; }
    }
    if (merged && !soulA.isDragging && !soulB.isDragging) {
      const pullDist = Math.hypot(soulB.tx - soulA.tx, soulB.ty - soulA.ty);
      if (pullDist > 120) beginSeparation();
      else {

        soulA.tx = mergeLock.x; soulA.ty = mergeLock.y;
        soulB.tx = mergeLock.x; soulB.ty = mergeLock.y;
      }
    }
  });
  let activeNode = null;
  let mouseRight = false;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    lastInteract = performance.now();
    if (e.button === 2) { mouseRight = true; }
    if (merged) {
      if (e.button === 2) {
        beginSeparation();
        return;
      }

      soulA.isDragging = true; soulB.isDragging = true; activeNode = soulA;
      return;
    }
    const dA = Math.hypot(soulA.x - e.clientX, soulA.y - e.clientY);
    const dB = Math.hypot(soulB.x - e.clientX, soulB.y - e.clientY);
    if (dA < dB && dA < 70) { soulA.isDragging = true; activeNode = soulA; }
    else if (dB < 70) { soulB.isDragging = true; activeNode = soulB; }
  });
  window.addEventListener('mousemove', e => {
    lastInteract = performance.now();
    if (activeNode) {
      activeNode.tx = e.clientX; activeNode.ty = e.clientY;
      if (merged) {
        soulA.tx = e.clientX; soulA.ty = e.clientY;
        soulB.tx = e.clientX; soulB.ty = e.clientY;
        mergeLock.x = e.clientX; mergeLock.y = e.clientY;
      }
    } else { shy(soulA, e.clientX, e.clientY); shy(soulB, e.clientX, e.clientY); }
  });
  window.addEventListener('mouseup', e => { if (e.button === 2) { mouseRight = false; } if (activeNode) { activeNode.isDragging = false; soulA.isDragging = false; soulB.isDragging = false; activeNode = null; } });
  window.addEventListener('deviceorientation', e => { tiltX = (e.gamma || 0) * .5; tiltY = (e.beta || 0) * .25; });
  window.addEventListener('resize', resize);
  document.getElementById('replayBtn').addEventListener('click', () => {
    finaleEl.classList.remove('visible');
    document.getElementById('replayBtn').classList.remove('visible');
    setTimeout(() => resetAll(), 400);
  });
  resize();
  requestAnimationFrame(render);
})();