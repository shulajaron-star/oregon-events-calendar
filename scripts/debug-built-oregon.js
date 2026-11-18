import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  await page.goto('https://www.builtoregon.com/events', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  const debug = await page.evaluate(() => {
    const cards = document.querySelectorAll('.eventlist-event');
    const firstEvent = cards[0];

    if (!firstEvent) return { error: 'No events found' };

    const timeEl = firstEvent.querySelector('.eventlist-meta-time');

    return {
      hasTimeElement: !!timeEl,
      timeText: timeEl?.textContent?.trim(),
      timeHTML: timeEl?.outerHTML
    };
  });

  console.log(JSON.stringify(debug, null, 2));

  await browser.close();
})();
