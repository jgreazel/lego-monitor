const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

// Initialize Puppeteer with Stealth Plugin
puppeteer.use(StealthPlugin());

/**
 * Initialize a browser instance with stealth plugin
 * @param {boolean} headless - Whether to run browser in headless mode
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function initBrowser(headless = true) {
  return await puppeteer.launch({ headless });
}

/**
 * Fetch HTML content from a URL
 * @param {Page} page - Puppeteer page instance
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchPageContent(page, url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  return await page.content();
}

/**
 * Ensure a directory exists, create it if it doesn't
 * @param {string} dir - Directory path to ensure exists
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save content to a file
 * @param {string} filename - Name of the file
 * @param {string} content - Content to save
 * @param {string} dir - Directory to save to (defaults to current directory)
 */
function saveFile(filename, content, dir = __dirname) {
  ensureDirectoryExists(dir);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, content, "utf8");
  return filepath;
}

/**
 * Generate timestamp for filenames
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Parse set-numbers txt file to extract URLs and set numbers
 * @param {string} filePath - Path to the set-numbers txt file
 * @returns {Array<{setNumber: string, name: string, url: string}>} Array of set information
 */
function parseSetNumbersFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const sets = [];

  // Match patterns like:
  // 1. Set Number: 75331
  //    Name: 75331 The Razor Crest
  //    URL: https://www.brickeconomy.com/set/...
  const regex = /Set Number: (\d+)\s+Name: (.+?)\s+URL: (.+?)(?=\n\n|\n*$)/gs;

  let match;
  while ((match = regex.exec(content)) !== null) {
    sets.push({
      setNumber: match[1].trim(),
      name: match[2].trim(),
      url: match[3].trim(),
    });
  }

  return sets;
}

/**
 * Find the most recent file matching a pattern
 * @param {string} pattern - Glob pattern to search for
 * @param {string} dir - Directory to search in
 * @returns {string|null} Path to most recent file or null
 */
function findMostRecentFile(pattern, dir = __dirname) {
  const files = fs.readdirSync(dir);
  const matchingFiles = files.filter((file) => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return regex.test(file);
  });

  if (matchingFiles.length === 0) return null;

  // Sort by modification time (most recent first)
  matchingFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(dir, a));
    const statB = fs.statSync(path.join(dir, b));
    return statB.mtime - statA.mtime;
  });

  return path.join(dir, matchingFiles[0]);
}

module.exports = {
  initBrowser,
  fetchPageContent,
  saveFile,
  getTimestamp,
  parseSetNumbersFile,
  findMostRecentFile,
  ensureDirectoryExists,
};
