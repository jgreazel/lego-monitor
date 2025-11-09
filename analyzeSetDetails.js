const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const {
  saveFile,
  getTimestamp,
  findMostRecentFile,
  ensureDirectoryExists,
} = require("./utils");

/**
 * Extract set details from HTML content
 * @param {string} html - HTML content
 * @param {string} setNumber - Set number
 * @returns {Object} Extracted set details
 */
function extractSetDetails(html, setNumber) {
  const $ = cheerio.load(html);
  const details = {
    setNumber: setNumber,
    name: "",
    theme: "",
    year: "",
    pieces: "",
    minifigs: "",
    minifigsValue: "",
    retailPrice: "",
    marketPrice: "",
    marketPriceChange: "",
    currentValue: {
      newSealed: "",
      used: "",
      usedRange: "",
    },
    availability: "",
    retired: "",
    retirementEstimate: "",
    retirementPop: "",
    annualGrowthFirstYear: "",
    annualGrowthSecondYear: "",
    oneYearRetiredValue: "",
    fiveYearsRetiredValue: "",
    pricePerPiece: "",
    rating: "",
    reviewCount: "",
  };

  try {
    // Extract from "Set Details" section
    const setDetailsBox = $("h4:contains('Set Details')").parent().next();
    setDetailsBox.find(".row.rowlist").each((i, elem) => {
      const label = $(elem).find(".text-muted").first().text().trim();
      const value = $(elem).find(".col-xs-7").first().text().trim();

      if (label.includes("Name")) {
        details.name = value;
      } else if (label.includes("Theme")) {
        details.theme = $(elem).find(".col-xs-7 a").first().text().trim();
      } else if (label.includes("Year")) {
        details.year = $(elem).find(".col-xs-7 a").first().text().trim();
      } else if (label.includes("Availability")) {
        details.availability = value;
      } else if (label.includes("Retired")) {
        details.retired = value;
      } else if (label.includes("Pieces")) {
        const piecesText = value;
        const piecesNum = piecesText.match(/^([\d,]+)/);
        if (piecesNum) details.pieces = piecesNum[1];
        const pppMatch = piecesText.match(/PPP \$(\d+\.\d+)/);
        if (pppMatch) details.pricePerPiece = `$${pppMatch[1]}`;
      } else if (label.includes("Minifigs")) {
        const minifigsText = value;
        const minifigsNum = minifigsText.match(/^(\d+)/);
        if (minifigsNum) details.minifigs = minifigsNum[1];
        const valueMatch = minifigsText.match(/Value \$(\d+\.\d+)/);
        if (valueMatch) details.minifigsValue = `$${valueMatch[1]}`;
      }
    });

    // Extract from "Set Pricing" section
    const setPricingBox = $("h4:contains('Set Pricing')").parent().next();
    setPricingBox.find(".row.rowlist").each((i, elem) => {
      const label = $(elem).find(".text-muted").first().text().trim();
      const value = $(elem).find(".col-xs-7").first();

      if (label.includes("Retail price")) {
        details.retailPrice = value.text().trim();
      } else if (label.includes("Market price")) {
        const marketText = value.text().trim();
        const priceMatch = marketText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) details.marketPrice = priceMatch[0];
        const changeMatch = marketText.match(/([-+]?\d+\.?\d*%)/);
        if (changeMatch) details.marketPriceChange = changeMatch[1];
      }
    });

    // Extract from "Set Predictions" section
    const setPredictionsBox = $("h4:contains('Set Predictions')")
      .parent()
      .next();
    setPredictionsBox.find(".row.rowlist").each((i, elem) => {
      const label = $(elem).find(".text-muted").first().text().trim();
      const value = $(elem).find(".col-xs-7").first();

      if (label.includes("Retirement") && !label.includes("pop")) {
        details.retirementEstimate = value.text().trim();
      } else if (label.includes("Retirement pop")) {
        details.retirementPop = value.text().trim();
      } else if (label.includes("Annual growth")) {
        // Get both annual growth values
        const growthDivs = value.find("div");
        if (growthDivs.length >= 1) {
          details.annualGrowthFirstYear = growthDivs.eq(0).text().trim();
        }
        if (growthDivs.length >= 2) {
          details.annualGrowthSecondYear = growthDivs.eq(1).text().trim();
        }
      } else if (label.includes("1 year retired")) {
        details.oneYearRetiredValue = value.find("div").first().text().trim();
      } else if (label.includes("5 years retired")) {
        details.fiveYearsRetiredValue = value.find("div").first().text().trim();
      }
    });

    // Extract rating from JSON-LD if available
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (jsonLdScript.length) {
      try {
        const jsonData = JSON.parse(jsonLdScript.html());
        details.rating = jsonData.aggregateRating?.ratingValue || "";
        details.reviewCount = jsonData.aggregateRating?.reviewCount || "";
      } catch (e) {
        // Ignore parsing errors
      }
    }
  } catch (error) {
    console.error(`Error parsing set ${setNumber}: ${error.message}`);
  }

  return details;
}

/**
 * Format set details as readable text
 * @param {Object} details - Set details object
 * @returns {string} Formatted text
 */
function formatSetDetailsAsText(details) {
  let text = `LEGO Set ${details.setNumber} - Analysis Report\n`;
  text += "=".repeat(70) + "\n\n";

  text += "SET INFORMATION\n";
  text += "-".repeat(70) + "\n";
  text += `Set Number: ${details.setNumber}\n`;
  text += `Name: ${details.name}\n`;
  text += `Theme: ${details.theme}\n`;
  text += `Pieces: ${details.pieces}\n`;
  text += `Minifigures: ${details.minifigs}${
    details.minifigsValue ? ` (Value: ${details.minifigsValue})` : ""
  }\n`;
  text += `Price Per Piece: ${details.pricePerPiece}\n`;
  text += `Rating: ${details.rating}${
    details.reviewCount ? ` (${details.reviewCount} reviews)` : ""
  }\n`;
  text += `Availability: ${details.availability}\n`;
  text += `Retired: ${details.retired}\n`;
  text += "\n";

  text += "PRICING INFORMATION\n";
  text += "-".repeat(70) + "\n";
  text += `Retail Price (MSRP): ${details.retailPrice}\n`;
  text += `Current Market Price: ${details.marketPrice}`;
  if (details.marketPriceChange) {
    text += ` (${details.marketPriceChange})`;
  }
  text += "\n";
  if (details.currentValue.newSealed) {
    text += `Current Value (New/Sealed): ${details.currentValue.newSealed}\n`;
  }
  if (details.currentValue.used) {
    text += `Current Value (Used): ${details.currentValue.used}`;
    if (details.currentValue.usedRange) {
      text += ` ${details.currentValue.usedRange}`;
    }
    text += "\n";
  }
  text += "\n";

  text += "RETIREMENT & PREDICTIONS\n";
  text += "-".repeat(70) + "\n";
  text += `Retirement Estimate: ${details.retirementEstimate}\n`;
  text += `Retirement Pop: ${details.retirementPop}\n`;
  text += `Annual Growth (First Year): ${details.annualGrowthFirstYear}\n`;
  text += `Annual Growth (Second Year): ${details.annualGrowthSecondYear}\n`;
  text += `1 Year Retired Value: ${details.oneYearRetiredValue}\n`;
  text += `5 Years Retired Value: ${details.fiveYearsRetiredValue}\n`;
  text += "\n";

  text += "-".repeat(70) + "\n";
  text += `Report generated: ${new Date().toLocaleString()}\n`;

  return text;
}

(async () => {
  try {
    // Find the most recent set-details directory
    const setDetailsBaseDir = path.join(__dirname, "set-details");

    if (!fs.existsSync(setDetailsBaseDir)) {
      console.error("Error: set-details directory not found!");
      console.log("Please run fetchSetDetails.js first.");
      process.exit(1);
    }

    const dirs = fs
      .readdirSync(setDetailsBaseDir)
      .filter((f) => fs.statSync(path.join(setDetailsBaseDir, f)).isDirectory())
      .sort()
      .reverse();

    if (dirs.length === 0) {
      console.error("Error: No set-details subdirectories found!");
      process.exit(1);
    }

    const latestDir = path.join(setDetailsBaseDir, dirs[0]);
    console.log(
      `Analyzing sets from: ${path.relative(__dirname, latestDir)}\n`
    );

    // Get all HTML files
    const files = fs.readdirSync(latestDir).filter((f) => f.endsWith(".html"));

    if (files.length === 0) {
      console.error("Error: No HTML files found in the directory!");
      process.exit(1);
    }

    console.log(`Found ${files.length} set(s) to analyze:\n`);

    // Create output directory
    const timestamp = getTimestamp();
    const outputDir = path.join(
      __dirname,
      "set-analysis",
      `analysis-${timestamp}`
    );
    ensureDirectoryExists(outputDir);

    // Process each file
    const allSetsData = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const setNumber = file.match(/set-(\d+)\.html/)[1];

      console.log(`[${i + 1}/${files.length}] Analyzing set ${setNumber}...`);

      const htmlPath = path.join(latestDir, file);
      const html = fs.readFileSync(htmlPath, "utf8");

      const details = extractSetDetails(html, setNumber);
      allSetsData.push(details);

      // Save individual set analysis
      const txtContent = formatSetDetailsAsText(details);
      const txtFilename = `set-${setNumber}-analysis.txt`;
      saveFile(txtFilename, txtContent, outputDir);

      console.log(`  ✓ Saved analysis to ${txtFilename}`);
    }

    // Create summary file
    console.log(`\nCreating summary report...`);
    let summary = "LEGO Sets Retiring Soon - Complete Analysis Summary\n";
    summary += "=".repeat(70) + "\n\n";
    summary += `Total Sets Analyzed: ${allSetsData.length}\n`;
    summary += `Analysis Date: ${new Date().toLocaleString()}\n\n`;
    summary += "=".repeat(70) + "\n\n";

    allSetsData.forEach((details, index) => {
      summary += `${index + 1}. Set ${details.setNumber}: ${details.name}\n`;
      summary += `   Theme: ${details.theme}\n`;
      summary += `   Retail: ${details.retailPrice} | Market: ${details.marketPrice}\n`;
      summary += `   Availability: ${details.availability}\n`;
      summary += `   Retired: ${details.retired}\n`;
      summary += `   Retirement Estimate: ${details.retirementEstimate}\n`;
      summary += `   Annual Growth (1Y): ${details.annualGrowthFirstYear}\n`;
      summary += `   5 Years Retired Value: ${details.fiveYearsRetiredValue}\n`;
      summary += "\n";
    });

    saveFile("_summary.txt", summary, outputDir);
    console.log(`✓ Saved summary to _summary.txt`);

    console.log(
      `\n✓ Complete! All analysis files saved to: ${path.relative(
        __dirname,
        outputDir
      )}`
    );
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
})();
