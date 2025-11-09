const fs = require("fs");
const path = require("path");

/**
 * Manages a registry of LEGO sets being monitored
 */
class SetRegistry {
  constructor(registryPath) {
    this.registryPath = registryPath;
    this.sets = new Map();
    this.load();
  }

  /**
   * Load registry from file
   */
  load() {
    if (fs.existsSync(this.registryPath)) {
      const data = JSON.parse(fs.readFileSync(this.registryPath, "utf8"));
      this.sets = new Map(Object.entries(data.sets || {}));
      console.log(`Loaded ${this.sets.size} sets from registry`);
    } else {
      console.log("No existing registry found, starting fresh");
    }
  }

  /**
   * Save registry to file
   */
  save() {
    const data = {
      lastUpdated: new Date().toISOString(),
      sets: Object.fromEntries(this.sets),
    };
    fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2), "utf8");
  }

  /**
   * Add or update a set in the registry
   * @param {string} setNumber - Set number
   * @param {Object} setInfo - Set information
   */
  addSet(setNumber, setInfo) {
    const existing = this.sets.get(setNumber);

    if (existing) {
      // Update existing set
      this.sets.set(setNumber, {
        ...existing,
        ...setInfo,
        lastSeen: new Date().toISOString(),
        timesFound: (existing.timesFound || 1) + 1,
      });
    } else {
      // Add new set
      this.sets.set(setNumber, {
        ...setInfo,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        timesFound: 1,
      });
    }
  }

  /**
   * Get all set numbers
   * @returns {Array<string>} Array of set numbers
   */
  getAllSetNumbers() {
    return Array.from(this.sets.keys());
  }

  /**
   * Get set info by number
   * @param {string} setNumber - Set number
   * @returns {Object|null} Set information
   */
  getSet(setNumber) {
    return this.sets.get(setNumber) || null;
  }

  /**
   * Get all sets
   * @returns {Array<Object>} Array of all sets with their info
   */
  getAllSets() {
    return Array.from(this.sets.entries()).map(([setNumber, info]) => ({
      setNumber,
      ...info,
    }));
  }

  /**
   * Get count of sets
   * @returns {number} Number of sets in registry
   */
  count() {
    return this.sets.size;
  }

  /**
   * Remove a set from the registry
   * @param {string} setNumber - Set number to remove
   * @returns {boolean} True if set was removed
   */
  removeSet(setNumber) {
    return this.sets.delete(setNumber);
  }

  /**
   * Mark a set as monitored (user wants to track it)
   * @param {string} setNumber - Set number
   */
  markAsMonitored(setNumber) {
    const set = this.sets.get(setNumber);
    if (set) {
      set.monitoring = true;
      set.monitoringSince = set.monitoringSince || new Date().toISOString();
    }
  }

  /**
   * Get all monitored sets
   * @returns {Array<Object>} Array of monitored sets
   */
  getMonitoredSets() {
    return this.getAllSets().filter((set) => set.monitoring);
  }
}

module.exports = SetRegistry;
