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
    retirementStatus: "",
    retirementDate: "",
    predictions: {
      annualGrowth: "",
      valueAfterRetirement: "",
      retirementRisk: "",
    },
    pricePerPiece: "",
    rating: "",
    reviewCount: "",
  };

  try {
    // Extract JSON-LD structured data
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (jsonLdScript.length) {
      const jsonData = JSON.parse(jsonLdScript.html());
      details.name = jsonData.name || "";
      details.rating = jsonData.aggregateRating?.ratingValue || "";
      details.reviewCount = jsonData.aggregateRating?.reviewCount || "";

      if (jsonData.offers) {
        details.marketPrice = `$${jsonData.offers.lowPrice} - $${jsonData.offers.highPrice}`;
      }
    }

    // Extract meta description for pieces info
    const metaDesc = $('meta[name="description"]').attr("content") || "";
    const piecesMatch = metaDesc.match(/(\d{1,3}(?:,\d{3})*) piece/);
    if (piecesMatch) {
      details.pieces = piecesMatch[1];
    }

    // Extract theme from breadcrumb
    const breadcrumbScript = $('script[type="application/ld+json"]').eq(1);
    if (breadcrumbScript.length) {
      try {
        const breadcrumbData = JSON.parse(breadcrumbScript.html());
        if (
          breadcrumbData.itemListElement &&
          breadcrumbData.itemListElement[1]
        ) {
          details.theme = breadcrumbData.itemListElement[1].name || "";
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Extract from row list sections
    $(".row.rowlist").each((i, elem) => {
      const label = $(elem).find(".text-muted").first().text().trim();
      const value = $(elem).find(".col-xs-7").text().trim();

      if (label.includes("Availability")) {
        details.availability = value;
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
      } else if (label.includes("Retail price")) {
        details.retailPrice = value;
      } else if (label.includes("Market price")) {
        const marketText = value;
        const priceMatch = marketText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) details.marketPrice = priceMatch[0];
        const changeMatch = marketText.match(/([-+]?\d+\.?\d*%)/);
        if (changeMatch) details.marketPriceChange = changeMatch[1];
      }
    });

    // Extract retirement and prediction information from description
    const description = $(".mt-20").first().text();

    // Extract retirement date
    const retirementMatch = description.match(
      /estimated to retire sometime within\s+(.+?)\./
    );
    if (retirementMatch) {
      details.retirementDate = retirementMatch[1].trim();
    }

    // Extract annual growth prediction
    const growthMatch = description.match(
      /expected annual growth will be close to\s+(\d+%)/
    );
    if (growthMatch) {
      details.predictions.annualGrowth = growthMatch[1];
    }

    // Extract value prediction after retirement
    const valueMatch = description.match(
      /valuing the set between\s+\$(\d+)\s+and\s+\$(\d+)/
    );
    if (valueMatch) {
      details.predictions.valueAfterRetirement = `$${valueMatch[1]} - $${valueMatch[2]}`;
    }

    // Extract current average price
    const currentPriceMatch = description.match(
      /current average price.*?is around\s+\$(\d+)/
    );
    if (currentPriceMatch) {
      details.currentValue.newSealed = `$${currentPriceMatch[1]}`;
    }

    // Extract retirement risk
    const retirementRiskDiv = $(".mt-20").filter((i, el) => {
      return $(el).text().includes("Retirement risk");
    });
    if (retirementRiskDiv.length) {
      details.predictions.retirementRisk = retirementRiskDiv
        .text()
        .replace(/Retirement risk\./, "")
        .trim();
    }

    // Check retirement status
    if (
      description.includes("Retiring soon") ||
      $("small.text-muted:contains('Retiring soon')").length
    ) {
      details.retirementStatus = "Retiring soon";
    } else if (details.availability.includes("Retired")) {
      details.retirementStatus = "Retired";
    } else if (details.availability.includes("retail")) {
      details.retirementStatus = "Available at retail";
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
  text += `Retirement Status: ${details.retirementStatus}\n`;
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
  if (details.retirementDate) {
    text += `Expected Retirement: ${details.retirementDate}\n`;
  }
  if (details.predictions.annualGrowth) {
    text += `Predicted Annual Growth: ${details.predictions.annualGrowth}\n`;
  }
  if (details.predictions.valueAfterRetirement) {
    text += `Expected Value After Retirement: ${details.predictions.valueAfterRetirement}\n`;
  }
  if (details.predictions.retirementRisk) {
    text += `\nRetirement Risk:\n${details.predictions.retirementRisk}\n`;
  }
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
      summary += `   Status: ${details.retirementStatus}\n`;
      if (details.retirementDate) {
        summary += `   Retirement: ${details.retirementDate}\n`;
      }
      if (details.predictions.annualGrowth) {
        summary += `   Growth: ${details.predictions.annualGrowth} | Value: ${details.predictions.valueAfterRetirement}\n`;
      }
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
