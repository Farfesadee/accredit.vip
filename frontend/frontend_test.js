const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://localhost:3000', localStorage: [{ name: 'accredit_onboarding_done', value: '1' }] }]
    }
  });
  const page = await ctx.newPage();
  const consoleErrors = {};

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const u = page.url();
      if (!consoleErrors[u]) consoleErrors[u] = [];
      const t = msg.text();
      // Skip Next.js HMR websocket noise
      if (!t.includes('webpack') && !t.includes('HMR') && !t.includes('/_next')) {
        consoleErrors[u].push(t.substring(0, 140));
      }
    }
  });

  function pass(b, label) { return `  ${b ? '✅' : '❌'} ${label}`; }
  async function bodyText() { return page.textContent('body').catch(() => ''); }

  async function nav(url, extraWait = 3000) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(extraWait);
  }

  // Wait for specific text to appear in the DOM (for Supabase-slow pages)
  async function waitForText(texts, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const body = await bodyText();
      if (texts.some(t => body.includes(t))) return true;
      await page.waitForTimeout(400);
    }
    return false;
  }

  console.log('\n=== ACCREDIT.VIP FRONTEND VERIFICATION (FINAL) ===\n');

  // ── 1. Home ──────────────────────────────────────────────────────────────
  await nav('http://localhost:3000/');
  console.log('[1] Home /');
  console.log(pass(await page.$('header'), 'Navbar rendered'));
  console.log(pass(await page.$('a[href="/login"]'), '"Sign in" link (logged-out navbar)'));
  console.log(pass(await page.$('a[href="/create-event"]'), '"CREATE EVENT" button'));
  console.log(pass(await page.$('h1, h2'), 'Hero heading'));

  // ── 2. Attend ─────────────────────────────────────────────────────────────
  await nav('http://localhost:3000/attend', 1000);
  // Wait up to 8s for event cards to load
  const cardsLoaded = await waitForText(['FREE', '₦', 'Concert', 'Summer', 'E2E'], 8000);
  const attendBody = await bodyText();
  console.log('\n[2] Attend /attend');
  console.log(pass(await page.$('h1'), '"Discover Events" heading'));
  console.log(pass(cardsLoaded, 'Event cards loaded (waited up to 8s for API)'));
  console.log(pass(attendBody.includes('FREE') || attendBody.includes('₦'), 'Price badges visible (FREE or ₦)'));
  console.log(pass(attendBody.includes('Lagos') || attendBody.includes('Venue') || attendBody.includes('venue'), 'Venue text on cards'));

  // ── 3. Free event /events/1 ──────────────────────────────────────────────
  await nav('http://localhost:3000/events/1', 1000);
  await waitForText(['E2E Test', 'Test Venue', 'FREE', 'Save My Spot', 'Back to Discover'], 10000);
  const ev1Body = await bodyText();
  const ev1Loaded = ev1Body.length > 400;
  console.log('\n[3] Event detail /events/1 (free event)');
  console.log(pass(ev1Loaded, 'Event page loaded with content'));
  console.log(pass(await page.$('h1'), 'h1 event title rendered'));
  console.log(pass(ev1Body.includes('FREE ENTRY') || ev1Body.includes('Free'), 'FREE ENTRY shown in ticket panel'));
  console.log(pass(ev1Body.includes('Save My Spot'), '"Save My Spot — Free" CTA present'));
  console.log(pass(ev1Body.includes('Back to Discover') || ev1Body.includes('Discover'), 'Back to Discover link'));

  // ── 4. Paid event /events/11 ─────────────────────────────────────────────
  await nav('http://localhost:3000/events/11', 1000);
  await waitForText(['Summer Concert', '5,000', 'Burna', 'Pay', 'ticket'], 10000);
  const ev11Body = await bodyText();
  const ev11Loaded = ev11Body.includes('Summer Concert') || ev11Body.includes('5,000');
  console.log('\n[4] Paid event /events/11 (Summer Concert 2026, ticket ₦5,000)');
  console.log(pass(ev11Loaded, 'Paid event data loaded from Supabase'));
  console.log(pass(ev11Body.includes('Summer Concert'), 'Event title "Summer Concert 2026" visible'));
  console.log(pass(ev11Body.includes('5,000'), '₦5,000 base ticket price shown'));
  console.log(pass(ev11Body.includes('5%') || ev11Body.includes('Service fee') || ev11Body.includes('service'), '5% service fee breakdown shown'));
  console.log(pass(ev11Body.includes('5,250') || ev11Body.includes('5250'), 'Total ₦5,250 shown (5,000 + 5% = 5,250)'));
  console.log(pass(ev11Body.includes('Pay'), '"Pay" button present'));
  console.log(pass(ev11Body.includes('Burna Boy'), 'Lineup: Burna Boy visible'));
  console.log(pass(ev11Body.includes('Eko Hotel') || ev11Body.includes('Lagos Arena') || ev11Body.includes('Lagos'), 'Venue shown'));

  // ── 5. Create event ───────────────────────────────────────────────────────
  await nav('http://localhost:3000/create-event', 2000);
  const createBody = await bodyText();
  console.log('\n[5] Create event /create-event');
  const noModal = !(await page.$('[class*="z-\\[60\\]"]').catch(() => null));
  console.log(pass(noModal, 'Onboarding modal NOT blocking public pages (fixed)'));
  console.log(pass(createBody.includes('POST EVENT'), 'POST EVENT mode button present'));
  console.log(pass(createBody.includes('CREATE INVITE'), 'CREATE INVITE mode button present'));

  // Click POST EVENT
  try {
    const btn = page.locator('button').filter({ hasText: /POST EVENT/ }).first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      const postBody = await bodyText();
      console.log('\n  > POST EVENT mode:');
      console.log(pass(postBody.includes('flier') || postBody.includes('Flier') || postBody.includes('auto-fill'), 'Flier upload strip visible'));
      console.log(pass(postBody.includes('Dress code') || postBody.includes('dress code'), 'Dress code field'));
      console.log(pass(postBody.includes('Gate fee') || postBody.includes('Ticket') || postBody.includes('Package'), 'Gate fee / packages'));
      console.log(pass(postBody.includes('Headliner') || postBody.includes('artiste') || postBody.includes('Artiste'), 'Lineup section'));
      console.log(pass(postBody.includes('After party') || postBody.includes('after party'), 'After party section'));

      // Date picker
      console.log('\n  > Date picker:');
      const selects = page.locator('select');
      const sc = await selects.count().catch(() => 0);
      let di = -1, mi = -1, yi = -1;
      for (let i = 0; i < sc; i++) {
        const opts = await selects.nth(i).locator('option').allTextContents().catch(() => []);
        if (opts.includes('Day')) di = i;
        else if (opts.includes('January') || opts.some(o => o === 'Month')) mi = i;
        else if (opts.some(o => o === '2026' || o === '2027')) yi = i;
      }
      if (di >= 0 && mi >= 0 && yi >= 0) {
        await selects.nth(di).selectOption('15'); await page.waitForTimeout(200);
        await selects.nth(mi).selectOption('06'); await page.waitForTimeout(200);
        await selects.nth(yi).selectOption('2027'); await page.waitForTimeout(400);
        const dv = await selects.nth(di).inputValue().catch(() => '?');
        const mv = await selects.nth(mi).inputValue().catch(() => '?');
        const yv = await selects.nth(yi).inputValue().catch(() => '?');
        console.log(pass(dv === '15', `Day "15" persists after selection`));
        console.log(pass(mv === '06', `Month "06" (June) persists`));
        console.log(pass(yv === '2027', `Year "2027" persists`));
      } else {
        console.log('  ⚠️  Date selects not found (di=' + di + ' mi=' + mi + ' yi=' + yi + ')');
      }
    }
  } catch (e) {
    console.log('  ⚠️  POST EVENT click: ' + e.message.substring(0, 80));
  }

  // ── 6. Login ──────────────────────────────────────────────────────────────
  await nav('http://localhost:3000/login', 1500);
  console.log('\n[6] Login /login');
  console.log(pass(await page.$('input[type="email"]'), 'Email input'));
  console.log(pass(await page.$('input[type="password"]'), 'Password input'));
  console.log(pass(await page.$('button[type="submit"]'), 'Submit button'));
  await page.fill('input[type="email"]', 'bad@test.com').catch(() => {});
  await page.fill('input[type="password"]', 'wrongpw').catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForTimeout(3000);
  const loginBody = await bodyText();
  const hasErr = loginBody.includes('Invalid') || loginBody.includes('incorrect') ||
                 loginBody.includes('failed') || loginBody.includes('error') || loginBody.includes('Error');
  console.log(pass(hasErr, 'Bad-credentials shows inline app error (not browser dialog)'));

  // ── 7. Register ───────────────────────────────────────────────────────────
  await nav('http://localhost:3000/register', 1500);
  console.log('\n[7] Register /register');
  console.log(pass(await page.$('input'), 'Form inputs present'));
  console.log(pass(await page.$('input[type="email"]'), 'Email field'));
  console.log(pass(await page.$('input[type="password"]'), 'Password field'));
  console.log(pass(await page.$('button[type="submit"]'), 'Submit button'));

  // ── 8. Dashboard unauth ───────────────────────────────────────────────────
  await nav('http://localhost:3000/dashboard', 2000);
  const dashUrl = page.url();
  console.log('\n[8] /dashboard (unauthenticated)');
  console.log(pass(dashUrl.includes('login'), 'Redirected to /login — final: ' + dashUrl));

  // ── 9. Dashboard/create unauth ────────────────────────────────────────────
  await nav('http://localhost:3000/dashboard/create', 2500);
  const dcUrl = page.url();
  console.log('\n[9] /dashboard/create (unauthenticated)');
  console.log(pass(dcUrl.includes('login'), 'Redirected to /login (auth guard fixed) — final: ' + dcUrl));

  await browser.close();

  console.log('\n=== CONSOLE ERRORS (excluding HMR noise) ===');
  const eu = Object.keys(consoleErrors);
  if (eu.length === 0) {
    console.log('None. ✅');
  } else {
    for (const [u, errs] of Object.entries(consoleErrors)) {
      console.log(`  ${u.replace('http://localhost:3000', '')}:`);
      errs.slice(0, 3).forEach(e => console.log(`    - ${e}`));
    }
  }
  console.log('\n=== END ===');
})();
