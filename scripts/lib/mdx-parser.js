import fs from 'fs/promises';
import matter from 'gray-matter';

/**
 * MDX file parser and updater for release notes
 */
export class MdxParser {
  /**
   * Read and parse MDX file
   * @param {string} filePath - Path to MDX file
   * @returns {Promise<Object>} Parsed file content with frontmatter and body
   */
  async readFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);
    
    return {
      frontmatter: parsed.data,
      frontmatterString: parsed.matter,
      body: parsed.content,
      originalContent: content
    };
  }

  /**
   * Insert a new Update entry at the top of the body
   * @param {string} body - Current MDX body content
   * @param {string} monthLabel - Month label (e.g., "December 2025")
   * @param {Array<string>} summaries - Array of formatted summary strings
   * @returns {string} Updated body with new entry
   */
  insertUpdateEntry(body, monthLabel, summaries) {
    if (summaries.length === 0) {
      return body; // Don't insert empty entries
    }

    const updateBlock = this.formatUpdateBlock(monthLabel, summaries);
    
    // Find the first <Update> tag or insert at the beginning
    const firstUpdateIndex = body.indexOf('<Update');
    
    if (firstUpdateIndex === -1) {
      // No existing Update entries, append after frontmatter separator
      return updateBlock + '\n\n' + body;
    } else {
      // Insert before the first Update entry
      return body.slice(0, firstUpdateIndex) + updateBlock + '\n\n' + body.slice(firstUpdateIndex);
    }
  }

  /**
   * Format an Update block with summaries
   * @param {string} monthLabel - Month label
   * @param {Array<string>} summaries - Array of summary strings
   * @returns {string} Formatted Update block
   */
  formatUpdateBlock(monthLabel, summaries) {
    const summaryLines = summaries.join('\n');
    return `<Update label="${monthLabel}">
${summaryLines}
</Update>`;
  }

  /**
   * Write updated content to file
   * @param {string} filePath - Path to MDX file
   * @param {Object} parsed - Parsed file content
   * @param {string} monthLabel - Month label
   * @param {Array<string>} summaries - Array of summary strings
   * @returns {Promise<void>}
   */
  async writeFile(filePath, parsed, monthLabel, summaries) {
    const updatedBody = this.insertUpdateEntry(parsed.body, monthLabel, summaries);
    
    // Reconstruct the file with frontmatter
    let content = '---\n';
    for (const [key, value] of Object.entries(parsed.frontmatter)) {
      content += `${key}: ${JSON.stringify(value)}\n`;
    }
    content += '---\n\n';
    content += updatedBody;

    // Create backup first
    const backupPath = `${filePath}.backup`;
    try {
      await fs.copyFile(filePath, backupPath);
    } catch (error) {
      console.warn(`Warning: Could not create backup: ${error.message}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Get current month label in format "Month Year"
   * @returns {string} Month label
   */
  getCurrentMonthLabel() {
    const now = new Date();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }
}
