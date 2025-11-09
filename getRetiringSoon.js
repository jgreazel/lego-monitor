const path = require("path");
const {
  initBrowser,
  fetchPageContent,
  saveFile,
  getTimestamp,
} = require("./utils");
const SetRegistry = require("./SetRegistry");

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
  const htmlDir = path.join(__dirname, "data", "retiring-soon-pages");
  const registryPath = path.join(__dirname, "data", "set-registry.json");

  // Save HTML content
  const htmlFilename = `retiring-soon-${timestamp}.html`;
  saveFile(htmlFilename, content, htmlDir);
  console.log(
    `HTML content saved to: ${path.join(
      "data/retiring-soon-pages",
      htmlFilename
    )}`
  );

  // Update registry with discovered sets
  const registry = new SetRegistry(registryPath);

  let newSets = 0;
  let updatedSets = 0;

  setNumbers.forEach((set) => {
    const wasNew = !registry.getSet(set.setNumber);
    registry.addSet(set.setNumber, {
      name: set.setName,
      url: set.url,
    });
    if (wasNew) {
      newSets++;
    } else {
      updatedSets++;
    }
  });

  registry.save();

  console.log(`\nRegistry updated:`);
  console.log(`  - Total sets in registry: ${registry.count()}`);
  console.log(`  - New sets found: ${newSets}`);
  console.log(`  - Existing sets updated: ${updatedSets}`);

  console.log(`\nFeatured retiring sets this scan:`);
  setNumbers.forEach((set) => {
    console.log(`  - ${set.setNumber}: ${set.setName}`);
  });

  await browser.close();
})();
