const fs = require("fs");
const path = require("path");

/**
 * Load analysis data from a specific timestamp
 * @param {string} timestamp - Timestamp directory name
 * @returns {Object|null} Analysis data or null if not found
 */
function loadAnalysisData(timestamp) {
  const filePath = path.join(
    __dirname,
    "data",
    "set-analysis",
    timestamp,
    "analysis-data.json"
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all available analysis snapshots sorted by date
 * @returns {Array} Array of {timestamp, date, data} objects
 */
function getAllSnapshots() {
  const analysisDir = path.join(__dirname, "data", "set-analysis");

  if (!fs.existsSync(analysisDir)) {
    console.error("No analysis data found. Run analyzeSetDetails.js first.");
    return [];
  }

  const snapshots = [];
  const dirs = fs.readdirSync(analysisDir);

  for (const dir of dirs) {
    const data = loadAnalysisData(dir);
    if (data && data.analysisDate) {
      snapshots.push({
        timestamp: dir,
        date: new Date(data.analysisDate),
        data: data,
      });
    }
  }

  // Sort by date (oldest first)
  snapshots.sort((a, b) => a.date - b.date);

  return snapshots;
}

/**
 * Parse price string to number (handles $XXX.XX format)
 * @param {string} priceStr - Price string like "$349.99"
 * @returns {number} Numeric value
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(priceStr.replace(/[$,]/g, "")) || 0;
}

/**
 * Parse percentage string to number (handles +X.X% format)
 * @param {string} percentStr - Percentage string like "+7.0%"
 * @returns {number} Numeric value
 */
function parsePercent(percentStr) {
  if (!percentStr) return 0;
  return parseFloat(percentStr.replace(/[+%]/g, "")) || 0;
}

/**
 * Calculate price change between two values
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @returns {Object} Change amount and percentage
 */
function calculateChange(oldPrice, newPrice) {
  if (!oldPrice || !newPrice) {
    return { amount: 0, percent: 0 };
  }

  const amount = newPrice - oldPrice;
  const percent = (amount / oldPrice) * 100;

  return {
    amount: amount,
    percent: percent,
  };
}

/**
 * Track price history for a specific set
 * @param {string} setNumber - Set number to track
 * @param {Array} snapshots - Array of snapshot objects
 * @returns {Object} Price history data
 */
function trackSetPrices(setNumber, snapshots) {
  const history = {
    setNumber: setNumber,
    name: null,
    theme: null,
    msrp: null,
    dataPoints: [],
  };

  for (const snapshot of snapshots) {
    const setData = snapshot.data.sets.find((s) => s.setNumber === setNumber);

    if (setData) {
      // Store basic info (from first occurrence)
      if (!history.name) {
        history.name = setData.name;
        history.theme = setData.theme;
        history.msrp = parsePrice(setData.retailPrice);
      }

      history.dataPoints.push({
        date: snapshot.date,
        timestamp: snapshot.timestamp,
        marketPrice: parsePrice(setData.currentMarketPrice),
        availability: setData.availability,
        retired: setData.retired,
        retirementEstimate: setData.retirementEstimate,
        retirementPop: parsePercent(setData.retirementPop),
        firstYearGrowth: parsePercent(setData.annualGrowthFirstYear),
        oneYearValue: parsePrice(setData.oneYearRetiredValue),
      });
    }
  }

  // Calculate changes over time
  if (history.dataPoints.length > 1) {
    const first = history.dataPoints[0];
    const last = history.dataPoints[history.dataPoints.length - 1];
    const change = calculateChange(first.marketPrice, last.marketPrice);

    history.summary = {
      firstSeen: first.date,
      lastSeen: last.date,
      daysTracked: Math.floor((last.date - first.date) / (1000 * 60 * 60 * 24)),
      snapshotCount: history.dataPoints.length,
      priceChange: {
        initial: first.marketPrice,
        current: last.marketPrice,
        amount: change.amount,
        percent: change.percent,
      },
      retirementStatus: {
        initial: first.availability,
        current: last.availability,
        hasRetired: last.retired !== "" && last.retired !== null,
        retiredDate: last.retired,
      },
    };
  }

  return history;
}

/**
 * Generate a price tracking report for all sets
 * @param {Array} snapshots - Array of snapshot objects
 * @returns {string} Formatted report
 */
function generateReport(snapshots) {
  if (snapshots.length === 0) {
    return "No analysis data found. Run analyzeSetDetails.js first.";
  }

  if (snapshots.length === 1) {
    return `Only one snapshot found (${snapshots[0].date.toLocaleDateString()}).\nRun the monitoring workflow again to build historical data.`;
  }

  // Get all unique set numbers across all snapshots
  const setNumbers = new Set();
  snapshots.forEach((snapshot) => {
    snapshot.data.sets.forEach((set) => {
      setNumbers.add(set.setNumber);
    });
  });

  // Track each set
  const setHistories = Array.from(setNumbers)
    .map((setNumber) => trackSetPrices(setNumber, snapshots))
    .filter((h) => h.dataPoints.length > 0);

  // Sort by most significant price change
  setHistories.sort((a, b) => {
    const aChange = a.summary ? Math.abs(a.summary.priceChange.percent) : 0;
    const bChange = b.summary ? Math.abs(b.summary.priceChange.percent) : 0;
    return bChange - aChange;
  });

  // Generate report
  let report = "";
  report += "LEGO SET PRICE TRACKING REPORT\n";
  report += "=".repeat(70) + "\n\n";
  report += `Analysis Period: ${snapshots[0].date.toLocaleDateString()} to ${snapshots[
    snapshots.length - 1
  ].date.toLocaleDateString()}\n`;
  report += `Total Snapshots: ${snapshots.length}\n`;
  report += `Sets Tracked: ${setHistories.length}\n`;
  report += "\n";

  // Summary of biggest movers
  report += "BIGGEST PRICE CHANGES\n";
  report += "-".repeat(70) + "\n";

  const topMovers = setHistories.slice(0, 10);
  for (const history of topMovers) {
    if (!history.summary) continue;

    const s = history.summary;
    const sign = s.priceChange.amount >= 0 ? "+" : "";

    report += `\nSet ${history.setNumber}: ${history.name}\n`;
    report += `  Price: $${s.priceChange.initial.toFixed(
      2
    )} → $${s.priceChange.current.toFixed(
      2
    )} (${sign}${s.priceChange.percent.toFixed(2)}%)\n`;
    report += `  Status: ${s.retirementStatus.initial} → ${s.retirementStatus.current}\n`;
    report += `  Tracked: ${s.daysTracked} days (${s.snapshotCount} snapshots)\n`;

    if (s.retirementStatus.hasRetired) {
      report += `  ⚠️  RETIRED: ${s.retirementStatus.retiredDate}\n`;
    }
  }

  // Retirement status section
  const retiredSets = setHistories.filter(
    (h) => h.summary && h.summary.retirementStatus.hasRetired
  );

  if (retiredSets.length > 0) {
    report += "\n\n";
    report += "RETIRED SETS (Testing Retirement Pop Hypothesis)\n";
    report += "-".repeat(70) + "\n";

    for (const history of retiredSets) {
      const s = history.summary;
      const sign = s.priceChange.amount >= 0 ? "+" : "";
      const lastData = history.dataPoints[history.dataPoints.length - 1];

      report += `\nSet ${history.setNumber}: ${history.name}\n`;
      report += `  MSRP: $${history.msrp.toFixed(2)}\n`;
      report += `  Retired: ${s.retirementStatus.retiredDate}\n`;
      report += `  Predicted Pop: +${lastData.retirementPop.toFixed(2)}%\n`;
      report += `  Actual Change: ${sign}${s.priceChange.percent.toFixed(
        2
      )}%\n`;
      report += `  Current Market: $${s.priceChange.current.toFixed(2)}\n`;

      if (history.msrp > 0) {
        const roi =
          ((s.priceChange.current - history.msrp) / history.msrp) * 100;
        report += `  ROI from MSRP: ${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%\n`;
      }
    }
  }

  return report;
}

/**
 * Generate detailed history for a specific set
 * @param {string} setNumber - Set number to detail
 * @param {Array} snapshots - Array of snapshot objects
 * @returns {string} Formatted detailed report
 */
function generateSetDetail(setNumber, snapshots) {
  const history = trackSetPrices(setNumber, snapshots);

  if (history.dataPoints.length === 0) {
    return `No data found for set ${setNumber}`;
  }

  let report = "";
  report += `PRICE HISTORY: Set ${setNumber} - ${history.name}\n`;
  report += "=".repeat(70) + "\n";
  report += `Theme: ${history.theme}\n`;
  report += `MSRP: $${history.msrp.toFixed(2)}\n\n`;

  if (history.summary) {
    const s = history.summary;
    report += "SUMMARY\n";
    report += "-".repeat(70) + "\n";
    report += `Tracking Period: ${s.daysTracked} days (${s.snapshotCount} snapshots)\n`;
    report += `Price Change: $${s.priceChange.initial.toFixed(
      2
    )} → $${s.priceChange.current.toFixed(2)} (${
      s.priceChange.amount >= 0 ? "+" : ""
    }${s.priceChange.percent.toFixed(2)}%)\n`;
    report += `Status: ${s.retirementStatus.initial} → ${s.retirementStatus.current}\n`;

    if (s.retirementStatus.hasRetired) {
      report += `Retired: ${s.retirementStatus.retiredDate}\n`;
    }
    report += "\n";
  }

  report += "DETAILED HISTORY\n";
  report += "-".repeat(70) + "\n";

  for (let i = 0; i < history.dataPoints.length; i++) {
    const point = history.dataPoints[i];

    report += `\n[${point.date.toLocaleDateString()}]\n`;
    report += `  Market Price: $${point.marketPrice.toFixed(2)}`;

    if (i > 0) {
      const prev = history.dataPoints[i - 1];
      const change = calculateChange(prev.marketPrice, point.marketPrice);
      const sign = change.amount >= 0 ? "+" : "";
      report += ` (${sign}$${Math.abs(change.amount).toFixed(
        2
      )}, ${sign}${change.percent.toFixed(2)}%)`;
    }

    report += "\n";
    report += `  Availability: ${point.availability}\n`;

    if (point.retired) {
      report += `  Retired: ${point.retired}\n`;
    }

    report += `  Retirement Est: ${point.retirementEstimate}\n`;
    report += `  Predicted Pop: +${point.retirementPop.toFixed(2)}%\n`;
    report += `  1st Year Growth: +${point.firstYearGrowth.toFixed(2)}%\n`;
    report += `  1 Year Value: $${point.oneYearValue.toFixed(2)}\n`;
  }

  return report;
}

// Main execution
async function main() {
  console.log("Loading analysis snapshots...\n");

  const snapshots = getAllSnapshots();

  if (snapshots.length === 0) {
    console.log("No snapshots found. Run analyzeSetDetails.js first.");
    return;
  }

  console.log(`Found ${snapshots.length} snapshot(s)\n`);

  // Check for command line arguments
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Detail view for specific set
    const setNumber = args[0];
    console.log(generateSetDetail(setNumber, snapshots));
  } else {
    // Summary view for all sets
    console.log(generateReport(snapshots));
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
