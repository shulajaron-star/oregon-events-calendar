#!/usr/bin/env node

/**
 * Debug Script - Page Structure Inspector
 *
 * Opens pages in Playwright and shows what HTML structure exists
 * Helps identify the right selectors for scraping
 */

import { chromium } from 'playwright';

async function debugPage(url, name) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n🔍 Debugging: ${name}`);
  console.log(`   URL: ${url}\n`);

  const browser = await chromium.launch({ headless: false }); // Set to false to see browser
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait 5 seconds for content to load

    // Extract page structure
    const info = await page.evaluate(() => {
      // Find all elements that might be events
      const allElements = document.querySelectorAll('*');
      const classNames = new Set();
      const idNames = new Set();

      // Look for common event-related class names
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls && (
              cls.toLowerCase().includes('event') ||
              cls.toLowerCase().includes('card') ||
              cls.toLowerCase().includes('item') ||
              cls.toLowerCase().includes('list')
            )) {
              classNames.add(`.${cls}`);
            }
          });
        }

        if (el.id) {
          idNames.add(`#${el.id}`);
        }
      });

      // Try to find text that looks like event titles
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => ({ tag: h.tagName, text: h.textContent?.trim().substring(0, 60), classes: h.className }))
        .filter(h => h.text && h.text.length > 10)
        .slice(0, 10);

      // Look for dates
      const dates = Array.from(document.querySelectorAll('time, [class*="date"], [class*="Date"]'))
        .map(d => ({ tag: d.tagName, text: d.textContent?.trim(), classes: d.className }))
        .slice(0, 10);

      return {
        title: document.title,
        classNamesFound: Array.from(classNames).slice(0, 20),
        idNamesFound: Array.from(idNames).slice(0, 10),
        headings,
        dates,
        bodyText: document.body?.innerText?.substring(0, 500)
      };
    });

    console.log('📄 Page Info:');
    console.log(`   Title: ${info.title}\n`);

    console.log('🏷️  Event-related Classes Found:');
    info.classNamesFound.forEach(cls => console.log(`   ${cls}`));

    console.log('\n📋 Headings Found:');
    info.headings.forEach((h, i) => {
      console.log(`   ${i + 1}. <${h.tag}> ${h.text}`);
      if (h.classes) console.log(`      Classes: ${h.classes}`);
    });

    console.log('\n📅 Date Elements Found:');
    info.dates.forEach((d, i) => {
      console.log(`   ${i + 1}. <${d.tag}> ${d.text}`);
      if (d.classes) console.log(`      Classes: ${d.classes}`);
    });

    console.log('\n📝 Page Text Sample:');
    console.log(info.bodyText);

    // Take a screenshot
    await page.screenshot({ path: `/tmp/${name.replace(/\s+/g, '_')}_debug.png`, fullPage: true });
    console.log(`\n📸 Screenshot saved: /tmp/${name.replace(/\s+/g, '_')}_debug.png`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  await debugPage('https://oregonlifesciences.org/events', 'OLS');
  await debugPage('https://oen.app.neoncrm.com/nx/portal/event-calendar', 'OEN');

  console.log('\n' + '='.repeat(80));
  console.log('\n✓ Debug complete!');
  console.log('\nUse the information above to update selectors in harvest-html-pages.js\n');
}

main().catch(console.error);
