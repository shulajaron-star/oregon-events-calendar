import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Check one specific event page
  await page.goto('https://www.techoregon.org/event/saif-webinar-course-and-scope', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const eventInfo = await page.evaluate(() => {
    const bodyText = document.body.innerText;

    // Look for time elements
    const timeElements = document.querySelectorAll('time, [class*="time"], [class*="date"]');
    const times = Array.from(timeElements).slice(0, 5).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent?.trim(),
      datetime: el.getAttribute('datetime')
    }));

    return {
      title: document.title,
      bodyPreview: bodyText.substring(0, 500),
      timeElements: times
    };
  });

  console.log(JSON.stringify(eventInfo, null, 2));

  await browser.close();
})();
