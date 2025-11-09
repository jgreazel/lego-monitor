const path = require("path");
const {
  initBrowser,
  fetchPageContent,
  saveFile,
  getTimestamp,
} = require("./utils");

(async () => {
  const browser = await initBrowser();
  const page = await browser.newPage();

  // Fetch the retiring soon page
  const content = await fetchPageContent(
    page,
    "https://www.brickeconomy.com/sets/retiring-soon"
  );

  // Extract LEGO set numbers from the three theme-stat divs
  const setNumbers = await page.evaluate(() => {
    const results = [];

    // Find all theme-stat divs
    const themeStats = document.querySelectorAll(".theme-stat");

    themeStats.forEach((div) => {
      // Find the link within each theme-stat div
      const link = div.querySelector('a[href^="/set/"]');
      if (link) {
        const href = link.getAttribute("href");
        // Extract set number from href pattern: /set/{NUMBER}-{VARIANT}/...
        const match = href.match(/\/set\/(\d+)-/);
        if (match) {
          const setNumber = match[1];
          const setName = link.textContent.trim();
          results.push({
            setNumber: setNumber,
            setName: setName,
            url: `https://www.brickeconomy.com${href}`,
          });
        }
      }
    });

    return results;
  });

  // Create output filename with timestamp
  const timestamp = getTimestamp();

  // Define output directories
  const htmlDir = path.join(__dirname, "retiring-soon-pages");
  const txtDir = path.join(__dirname, "set-numbers");

  // Save HTML content
  const htmlFilename = `retiring-soon-${timestamp}.html`;
  saveFile(htmlFilename, content, htmlDir);
  console.log(
    `HTML content saved to: ${path.join("retiring-soon-pages", htmlFilename)}`
  );

  // Save extracted set numbers to a text file
  const txtFilename = `set-numbers-${timestamp}.txt`;

  let txtContent = "LEGO Sets Retiring Soon - Featured Sets\n";
  txtContent += "=".repeat(50) + "\n\n";

  setNumbers.forEach((set, index) => {
    txtContent += `${index + 1}. Set Number: ${set.setNumber}\n`;
    txtContent += `   Name: ${set.setName}\n`;
    txtContent += `   URL: ${set.url}\n\n`;
  });

  saveFile(txtFilename, txtContent, txtDir);
  console.log(`Set numbers saved to: ${path.join("set-numbers", txtFilename)}`);
  console.log(`\nFound ${setNumbers.length} featured retiring sets:`);
  setNumbers.forEach((set) => {
    console.log(`  - ${set.setNumber}: ${set.setName}`);
  });

  await browser.close();
})();
