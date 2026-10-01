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

  const networkRequests = [];
  page.on('request', req => networkRequests.push({ url: req.url(), method: req.method() }));
  page.on('requestfailed', req => {
    if (!req.url().includes('_next') && !req.url().includes('webpack')) {
      console.log('FAILED REQUEST:', req.url(), req.failure()?.errorText);
    }
  });
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('localhost:8000') || url.includes('/api/')) {
      console.log('API RESPONSE:', resp.status(), url.replace('http://localhost:8000/api/v1', ''));
    }
  });

  console.log('\n--- Checking /attend ---');
  await page.goto('http://localhost:3000/attend', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  const body = await page.textContent('body').catch(() => '');
  console.log('Body length:', body.length);
  console.log('Contains FREE:', body.includes('FREE'));
  console.log('Contains ₦:', body.includes('₦'));
  console.log('Contains E2E:', body.includes('E2E'));
  console.log('Contains "No events":', body.includes('No events'));
  console.log('Contains "loading":', body.toLowerCase().includes('loading'));
  console.log('First 500 chars of body:', body.substring(0, 500));

  console.log('\n--- Checking /events/1 ---');
  await page.goto('http://localhost:3000/events/1', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  const ev1 = await page.textContent('body').catch(() => '');
  console.log('Body length:', ev1.length);
  console.log('Contains "E2E Test":', ev1.includes('E2E Test'));
  console.log('Contains "FREE ENTRY":', ev1.includes('FREE ENTRY'));
  console.log('Contains "Save My Spot":', ev1.includes('Save My Spot'));
  console.log('First 600 chars:', ev1.substring(0, 600));

  console.log('\n--- Checking /events/11 ---');
  await page.goto('http://localhost:3000/events/11', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  const ev11 = await page.textContent('body').catch(() => '');
  console.log('Body length:', ev11.length);
  console.log('Contains "Summer Concert":', ev11.includes('Summer Concert'));
  console.log('Contains "5,000":', ev11.includes('5,000'));
  console.log('Contains "Service fee":', ev11.includes('Service fee') || ev11.includes('service'));
  console.log('First 600 chars:', ev11.substring(0, 600));

  await browser.close();
})();
