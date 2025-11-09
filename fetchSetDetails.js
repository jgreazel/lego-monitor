const fs = require("fs");
const path = require("path");
const {
  initBrowser,
  fetchPageContent,
  saveFile,
  getTimestamp,
  parseSetNumbersFile,
  findMostRecentFile,
} = require("./utils");

(async () => {
  try {
    // Look for set-numbers files in the set-numbers directory
    const setNumbersDir = path.join(__dirname, "set-numbers");

    // Find the most recent set-numbers file
    const setNumbersFile = findMostRecentFile(
      "set-numbers-.*\\.txt",
      setNumbersDir
    );

    if (!setNumbersFile) {
      console.error("Error: No set-numbers txt file found!");
      console.log(
        "Please run getRetiringSoon.js first to generate the set numbers file."
      );
      process.exit(1);
    }

    console.log(
      `Using set numbers file: ${path.relative(__dirname, setNumbersFile)}`
    );

    // Parse the set numbers file
    const sets = parseSetNumbersFile(setNumbersFile);

    if (sets.length === 0) {
      console.error("Error: No sets found in the file!");
      process.exit(1);
    }

    console.log(`Found ${sets.length} sets to fetch:\n`);
    sets.forEach((set, index) => {
      console.log(`  ${index + 1}. ${set.name} (${set.setNumber})`);
    });
    console.log("");

    // Create a directory for set detail pages
    const timestamp = getTimestamp();
    const outputDir = path.join(
      __dirname,
      "set-details",
      `set-details-${timestamp}`
    );
    console.log(`Output directory: ${path.relative(__dirname, outputDir)}\n`);

    // Initialize browser
    const browser = await initBrowser();
    const page = await browser.newPage();

    // Fetch each set's detail page
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

        // Add a small delay to be respectful to the server
        if (i < sets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`  ✗ Error fetching ${set.setNumber}: ${error.message}`);
      }
    }

    await browser.close();

    console.log(
      `\n✓ Complete! All set details saved to: ${path.relative(
        __dirname,
        outputDir
      )}`
    );
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
})();
