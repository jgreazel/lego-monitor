const fs = require("fs");
const path = require("path");
const {
  initBrowser,
  fetchPageContent,
  saveFile,
  getTimestamp,
} = require("./utils");
const SetRegistry = require("./SetRegistry");

(async () => {
  try {
    // Load the registry
    const registryPath = path.join(__dirname, "data", "set-registry.json");

    if (!fs.existsSync(registryPath)) {
      console.error("Error: Set registry not found!");
      console.log("Please run getRetiringSoon.js first to build the registry.");
      process.exit(1);
    }

    const registry = new SetRegistry(registryPath);
    const sets = registry.getAllSets();

    if (sets.length === 0) {
      console.error("Error: No sets found in registry!");
      process.exit(1);
    }

    console.log(`Found ${sets.length} sets in registry to fetch:\n`);
    sets.forEach((set, index) => {
      console.log(`  ${index + 1}. ${set.name} (${set.setNumber})`);
    });
    console.log("");

    // Create a timestamped directory for this fetch
    const timestamp = getTimestamp();
    const outputDir = path.join(__dirname, "data", "set-details", timestamp);
    console.log(`Output directory: data/set-details/${timestamp}\n`);

    // Initialize browser
    const browser = await initBrowser();
    const page = await browser.newPage();

    // Fetch each set's detail page
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      console.log(
        `[${i + 1}/${sets.length}] Fetching ${set.setNumber}: ${set.name}...`
      );

      try {
        const content = await fetchPageContent(page, set.url);
        const filename = `set-${set.setNumber}.html`;
        saveFile(filename, content, outputDir);
        console.log(`  ✓ Saved to ${filename}`);
        successCount++;

        // Add a small delay to be respectful to the server
        if (i < sets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`  ✗ Error fetching ${set.setNumber}: ${error.message}`);
        errorCount++;
      }
    }

    await browser.close();

    console.log(`\n✓ Complete!`);
    console.log(`  - Successfully fetched: ${successCount} sets`);
    console.log(`  - Errors: ${errorCount} sets`);
    console.log(`  - Saved to: data/set-details/${timestamp}`);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
})();
