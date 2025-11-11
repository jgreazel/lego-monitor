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

  // Extract LEGO set numbers from specific categories
  const setNumbers = await page.evaluate(() => {
    const results = [];
    const targetCategories = ["Star Wars", "Marvel Super Heroes"];

    // Find all h3 headers
    const headers = document.querySelectorAll("h3.mt-30.mb-10");

    headers.forEach((header) => {
      const categoryName = header.textContent.trim();

      // Check if this is one of our target categories
      if (targetCategories.includes(categoryName)) {
        // Navigate up to the parent row, then get all following rows until the next category header
        let currentRow = header.closest("tr");
        if (!currentRow) return;

        // Move to the next sibling row
        currentRow = currentRow.nextElementSibling;

        // Iterate through rows until we hit another category header or end
        while (currentRow) {
          // Check if this row contains a new category header
          const nextHeader = currentRow.querySelector("h3.mt-30.mb-10");
          if (nextHeader) {
            break; // Stop at the next category
          }

          // Look for set links in this row
          const links = currentRow.querySelectorAll('a[href^="/set/"]');
          links.forEach((link) => {
            const href = link.getAttribute("href");
            // Extract set number from href pattern: /set/{NUMBER}-{VARIANT}/...
            const match = href.match(/\/set\/(\d+)-/);
            if (match) {
              const setNumber = match[1];
              // Get the set name from the h4 link
              const h4Link = currentRow.querySelector('h4 a[href^="/set/"]');
              const setName = h4Link
                ? h4Link.textContent.trim()
                : link.textContent.trim();

              // Avoid duplicates
              if (!results.find((r) => r.setNumber === setNumber)) {
                results.push({
                  setNumber: setNumber,
                  setName: setName,
                  category: categoryName,
                  url: `https://www.brickeconomy.com${href}`,
                });
              }
            }
          });

          currentRow = currentRow.nextElementSibling;
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

  console.log(`\nRetiring sets found by category:`);

  // Group sets by category for display
  const starWars = setNumbers.filter((s) => s.category === "Star Wars");
  const marvel = setNumbers.filter((s) => s.category === "Marvel Super Heroes");

  if (starWars.length > 0) {
    console.log(`\n  Star Wars (${starWars.length} sets):`);
    starWars.forEach((set) => {
      console.log(`    - ${set.setNumber}: ${set.setName}`);
    });
  }

  if (marvel.length > 0) {
    console.log(`\n  Marvel Super Heroes (${marvel.length} sets):`);
    marvel.forEach((set) => {
      console.log(`    - ${set.setNumber}: ${set.setName}`);
    });
  }

  await browser.close();
})();
