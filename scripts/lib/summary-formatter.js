/**
 * Formats and sorts summaries by API name
 */
export class SummaryFormatter {
  /**
   * Group summaries by API name and sort alphabetically
   * @param {Array<string>} summaries - Array of summary strings
   * @returns {Array<string>} Sorted array of summaries
   */
  formatAndSort(summaries) {
    // Extract API names and group summaries
    const apiMap = new Map();

    for (const summary of summaries) {
      const apiName = this.extractApiName(summary);
      if (apiName) {
        if (!apiMap.has(apiName)) {
          apiMap.set(apiName, []);
        }
        apiMap.get(apiName).push(summary);
      }
    }

    // Sort APIs alphabetically
    const sortedApis = Array.from(apiMap.keys()).sort((a, b) => 
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    // Build sorted summary list
    const sortedSummaries = [];
    for (const api of sortedApis) {
      sortedSummaries.push(...apiMap.get(api));
    }

    return sortedSummaries;
  }

  /**
   * Extract API name from a summary string
   * @param {string} summary - Summary string in format "- **API Name**: description"
   * @returns {string|null} API name or null if not found
   */
  extractApiName(summary) {
    const match = summary.match(/\*\*([^*]+)\*\*/);
    return match ? match[1].trim() : null;
  }

  /**
   * Deduplicate summaries (remove exact duplicates)
   * @param {Array<string>} summaries - Array of summary strings
   * @returns {Array<string>} Deduplicated summaries
   */
  deduplicate(summaries) {
    const seen = new Set();
    return summaries.filter(summary => {
      const normalized = summary.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }
}
