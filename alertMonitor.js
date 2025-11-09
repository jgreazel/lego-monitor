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
 * Extract retirement estimate timeframe (e.g., "Early 2026")
 * @param {string} retirementStr - Full retirement string
 * @returns {string} Timeframe portion
 */
function extractRetirementTimeframe(retirementStr) {
  if (!retirementStr) return "";
  // Extract everything before the percentage
  const match = retirementStr.match(/^(.+?)\s+\d+\.\d+%/);
  return match ? match[1].trim() : retirementStr;
}

/**
 * Check if a set is approaching retirement (within next 3 months)
 * @param {string} retirementEstimate - Retirement estimate string
 * @returns {boolean} True if approaching retirement soon
 */
function isApproachingRetirement(retirementEstimate) {
  if (!retirementEstimate) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11 (0=January, 11=December)

  const estimate = retirementEstimate.toLowerCase();

  // Check for current year AND current or next quarter
  if (estimate.includes(currentYear.toString())) {
    // Retiring this year - always approaching
    return true;
  }

  // For next year, only alert if we're close
  const nextYear = currentYear + 1;
  if (estimate.includes(nextYear.toString())) {
    // Only alert for "early next year" if we're in Q4 (Oct-Dec)
    if (estimate.includes("early") || estimate.includes("q1")) {
      return currentMonth >= 9; // October or later
    }
    // Only alert for "mid next year" if we're in Q1 next year (Jan-Mar)
    // Since we're checking current year, this won't trigger for mid/late next year
    return false;
  }

  return false;
}

/**
 * Detect retirement events by comparing snapshots
 * @param {Object} previous - Previous snapshot data
 * @param {Object} current - Current snapshot data
 * @returns {Array} Array of retirement alerts
 */
function detectRetirementEvents(previous, current) {
  const alerts = [];

  const prevSets = new Map(previous.sets.map((s) => [s.setNumber, s]));

  for (const currentSet of current.sets) {
    const prevSet = prevSets.get(currentSet.setNumber);

    if (!prevSet) continue; // New set, skip

    // Check if set just retired
    const wasNotRetired = !prevSet.retired || prevSet.retired === "";
    const isNowRetired = currentSet.retired && currentSet.retired !== "";

    if (wasNotRetired && isNowRetired) {
      const msrp = parsePrice(currentSet.retailPrice);
      const currentPrice = parsePrice(currentSet.marketPrice);
      const roi =
        msrp > 0 ? (((currentPrice - msrp) / msrp) * 100).toFixed(2) : "N/A";

      alerts.push({
        type: "RETIREMENT",
        priority: "HIGH",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) has RETIRED!`,
        details: {
          retiredDate: currentSet.retired,
          previousAvailability: prevSet.availability,
          currentPrice: `$${currentPrice.toFixed(2)}`,
          msrp: `$${msrp.toFixed(2)}`,
          currentROI: `${roi}%`,
          predictedPop: currentSet.retirementPop,
        },
      });
    }
  }

  return alerts;
}

/**
 * Check if retirement pop has been achieved
 * @param {Object} previous - Previous snapshot data
 * @param {Object} current - Current snapshot data
 * @returns {Array} Array of pop achievement alerts
 */
function checkRetirementPopAchievement(previous, current) {
  const alerts = [];

  const prevSets = new Map(previous.sets.map((s) => [s.setNumber, s]));

  for (const currentSet of current.sets) {
    const prevSet = prevSets.get(currentSet.setNumber);

    if (!prevSet) continue;

    // Only check retired sets
    if (!currentSet.retired || currentSet.retired === "") continue;

    const msrp = parsePrice(currentSet.retailPrice);
    const currentPrice = parsePrice(currentSet.marketPrice);
    const prevPrice = parsePrice(prevSet.marketPrice);
    const predictedPop = parsePercent(currentSet.retirementPop);
    const oneYearValue = parsePrice(currentSet.oneYearRetiredValue);

    if (msrp === 0) continue;

    // Calculate actual change from MSRP
    const actualChange = ((currentPrice - msrp) / msrp) * 100;

    // Check if predicted pop has been exceeded
    if (actualChange >= predictedPop && prevPrice < currentPrice) {
      const exceeded = actualChange - predictedPop;

      alerts.push({
        type: "POP_ACHIEVED",
        priority: "HIGH",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) has exceeded its predicted retirement pop!`,
        details: {
          predictedPop: `+${predictedPop.toFixed(2)}%`,
          actualChange: `+${actualChange.toFixed(2)}%`,
          exceededBy: `+${exceeded.toFixed(2)}%`,
          currentPrice: `$${currentPrice.toFixed(2)}`,
          msrp: `$${msrp.toFixed(2)}`,
          profit: `$${(currentPrice - msrp).toFixed(2)}`,
        },
      });
    }

    // Check if 1-year target value has been reached
    if (
      oneYearValue > 0 &&
      currentPrice >= oneYearValue &&
      prevPrice < oneYearValue
    ) {
      const roi = ((currentPrice - msrp) / msrp) * 100;

      alerts.push({
        type: "TARGET_REACHED",
        priority: "HIGH",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) has reached its 1-year target value!`,
        details: {
          targetValue: `$${oneYearValue.toFixed(2)}`,
          currentPrice: `$${currentPrice.toFixed(2)}`,
          msrp: `$${msrp.toFixed(2)}`,
          roi: `+${roi.toFixed(2)}%`,
          profit: `$${(currentPrice - msrp).toFixed(2)}`,
          recommendation: "Consider selling - target achieved",
        },
      });
    }
  }

  return alerts;
}

/**
 * Check for buying opportunities (price drops below MSRP)
 * @param {Object} previous - Previous snapshot data
 * @param {Object} current - Current snapshot data
 * @returns {Array} Array of buying opportunity alerts
 */
function checkBuyingOpportunities(previous, current) {
  const alerts = [];

  const prevSets = new Map(previous.sets.map((s) => [s.setNumber, s]));

  for (const currentSet of current.sets) {
    const prevSet = prevSets.get(currentSet.setNumber);

    if (!prevSet) continue;

    // Skip retired sets
    if (currentSet.retired && currentSet.retired !== "") continue;

    const msrp = parsePrice(currentSet.retailPrice);
    const currentPrice = parsePrice(currentSet.marketPrice);
    const prevPrice = parsePrice(prevSet.marketPrice);

    if (msrp === 0) continue;

    // Check if price just dropped below MSRP
    const wasAboveMSRP = prevPrice >= msrp;
    const isBelowMSRP = currentPrice < msrp;

    if (wasAboveMSRP && isBelowMSRP) {
      const discount = ((msrp - currentPrice) / msrp) * 100;
      const predictedPop = parsePercent(currentSet.retirementPop);
      const potentialProfit = msrp * (1 + predictedPop / 100) - currentPrice;

      alerts.push({
        type: "BUYING_OPPORTUNITY",
        priority: "MEDIUM",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) is now below MSRP - Buying opportunity!`,
        details: {
          currentPrice: `$${currentPrice.toFixed(2)}`,
          msrp: `$${msrp.toFixed(2)}`,
          discount: `-${discount.toFixed(2)}%`,
          savings: `$${(msrp - currentPrice).toFixed(2)}`,
          predictedPop: `+${predictedPop.toFixed(2)}%`,
          potentialProfit: `$${potentialProfit.toFixed(2)}`,
          retirementEstimate: currentSet.retirementEstimate,
        },
      });
    }
  }

  return alerts;
}

/**
 * Check for newly retired sets (moved from available to retired)
 * @param {Object} previous - Previous snapshot data
 * @param {Object} current - Current snapshot data
 * @returns {Array} Array of newly retired set alerts
 */
function checkNewlyRetiredSets(previous, current) {
  const alerts = [];

  const prevSets = new Map(previous.sets.map((s) => [s.setNumber, s]));

  for (const currentSet of current.sets) {
    const prevSet = prevSets.get(currentSet.setNumber);

    if (!prevSet) continue;

    // Check if set just became retired
    const wasNotRetired = !prevSet.retired || prevSet.retired === "";
    const isNowRetired = currentSet.retired && currentSet.retired !== "";

    if (wasNotRetired && isNowRetired) {
      const msrp = parsePrice(currentSet.retailPrice);
      const currentPrice = parsePrice(currentSet.marketPrice);
      const predictedPop = parsePercent(currentSet.retirementPop);
      const priceChange = ((currentPrice - msrp) / msrp) * 100;

      alerts.push({
        type: "NEWLY_RETIRED",
        priority: "HIGH",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) has just retired!`,
        details: {
          retiredDate: currentSet.retired,
          msrp: `$${msrp.toFixed(2)}`,
          currentPrice: `$${currentPrice.toFixed(2)}`,
          priceChange: `${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(
            2
          )}%`,
          predictedPop: `+${predictedPop.toFixed(2)}%`,
          recommendation:
            priceChange >= predictedPop
              ? "Pop achieved! Monitor for selling opportunity"
              : "Watch for retirement pop in coming weeks",
        },
      });
    }
  }

  return alerts;
}

/**
 * Check for ROI targets reached (configurable threshold)
 * @param {Object} previous - Previous snapshot data
 * @param {Object} current - Current snapshot data
 * @param {number} targetROI - Target ROI percentage (default 20%)
 * @returns {Array} Array of ROI target alerts
 */
function checkROITargets(previous, current, targetROI = 20) {
  const alerts = [];

  const prevSets = new Map(previous.sets.map((s) => [s.setNumber, s]));

  for (const currentSet of current.sets) {
    const prevSet = prevSets.get(currentSet.setNumber);

    if (!prevSet) continue;

    const msrp = parsePrice(currentSet.retailPrice);
    const currentPrice = parsePrice(currentSet.marketPrice);
    const prevPrice = parsePrice(prevSet.marketPrice);

    if (msrp === 0) continue;

    const currentROI = ((currentPrice - msrp) / msrp) * 100;
    const prevROI = ((prevPrice - msrp) / msrp) * 100;

    // Check if just crossed the target ROI threshold
    if (currentROI >= targetROI && prevROI < targetROI) {
      const profit = currentPrice - msrp;

      alerts.push({
        type: "ROI_TARGET",
        priority: "HIGH",
        setNumber: currentSet.setNumber,
        name: currentSet.name,
        message: `Set ${currentSet.setNumber} (${currentSet.name}) has reached ${targetROI}% ROI target!`,
        details: {
          targetROI: `${targetROI}%`,
          currentROI: `+${currentROI.toFixed(2)}%`,
          purchasePrice: `$${msrp.toFixed(2)}`,
          currentPrice: `$${currentPrice.toFixed(2)}`,
          profit: `$${profit.toFixed(2)}`,
          isRetired: currentSet.retired !== "" && currentSet.retired !== null,
          recommendation: "Target ROI reached - consider selling",
        },
      });
    }
  }

  return alerts;
}

/**
 * Format and display alerts
 * @param {Array} alerts - Array of alert objects
 * @param {string} category - Alert category name
 */
function displayAlerts(alerts, category) {
  if (alerts.length === 0) return;

  console.log("\n" + "=".repeat(70));
  console.log(`${category.toUpperCase()}`);
  console.log("=".repeat(70));

  for (const alert of alerts) {
    console.log(`\n[${alert.priority}] ${alert.message}`);
    console.log("-".repeat(70));

    for (const [key, value] of Object.entries(alert.details)) {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      console.log(`  ${label}: ${value}`);
    }
  }
}

/**
 * Generate alert summary
 * @param {Object} allAlerts - Object containing all alert categories
 * @returns {string} Summary text
 */
function generateSummary(allAlerts) {
  const totalAlerts = Object.values(allAlerts).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  if (totalAlerts === 0) {
    return "\n✓ No alerts at this time. All sets are stable.";
  }

  let summary = "\n" + "=".repeat(70) + "\n";
  summary += "ALERT SUMMARY\n";
  summary += "=".repeat(70) + "\n";
  summary += `Total Alerts: ${totalAlerts}\n\n`;

  for (const [category, alerts] of Object.entries(allAlerts)) {
    if (alerts.length > 0) {
      summary += `  ${category}: ${alerts.length}\n`;
    }
  }

  return summary;
}

// Main execution
async function main() {
  console.log("LEGO Set Alert Monitor");
  console.log("=".repeat(70));
  console.log("Checking for important events...\n");

  const snapshots = getAllSnapshots();

  if (snapshots.length < 2) {
    console.log("Need at least 2 snapshots to compare.");
    console.log("Current snapshots:", snapshots.length);
    console.log(
      "\nRun the monitoring workflow again to generate comparison data:"
    );
    console.log("  node getRetiringSoon.js");
    console.log("  node fetchSetDetails.js");
    console.log("  node analyzeSetDetails.js");
    return;
  }

  const previous = snapshots[snapshots.length - 2].data;
  const current = snapshots[snapshots.length - 1].data;

  console.log(`Comparing snapshots:`);
  console.log(
    `  Previous: ${new Date(previous.analysisDate).toLocaleString()}`
  );
  console.log(`  Current:  ${new Date(current.analysisDate).toLocaleString()}`);

  // Run all alert checks
  const allAlerts = {
    "Newly Retired Sets": checkNewlyRetiredSets(previous, current),
    "Retirement Pop Achieved": checkRetirementPopAchievement(previous, current),
    "Buying Opportunities": checkBuyingOpportunities(previous, current),
    "ROI Targets (20%)": checkROITargets(previous, current, 20),
  };

  // Display summary first
  console.log(generateSummary(allAlerts));

  // Display detailed alerts
  for (const [category, alerts] of Object.entries(allAlerts)) {
    displayAlerts(alerts, category);
  }

  console.log("\n" + "=".repeat(70));
  console.log("Alert monitoring complete.");
  console.log("=".repeat(70) + "\n");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
