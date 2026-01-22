import { execa } from 'execa';

/**
 * Claude CLI client wrapper for generating summaries
 */
export class ClaudeClient {
  constructor(model = 'claude-sonnet-4-20250514') {
    this.model = model;
    // Set environment variable as fallback if model flag doesn't work
    if (!process.env.ANTHROPIC_MODEL) {
      process.env.ANTHROPIC_MODEL = model;
    }
  }

  /**
   * Generate release notes summaries from a JIRA ticket
   * @param {Object} ticket - JIRA ticket object
   * @returns {Promise<Array<string>>} Array of formatted summary strings
   */
  async generateSummaries(ticket) {
    const prompt = this.buildPrompt(ticket);
    const methods = [
      {
        name: 'stdin input',
        args: [],
        stdin: prompt
      }
    ];

    for (const method of methods) {
      try {
        console.log(`  Trying Claude CLI method: ${method.name}`);
        const options = {
          timeout: 30000
        };
        if (method.stdin) {
          options.input = method.stdin;
        }
        
        const result = await execa('claude', method.args, options);
        
        const summaries = this.parseSummaries(result.stdout);
        if (summaries.length > 0) {
          return summaries;
        }
        // If no summaries parsed, try next method
      } catch (error) {
        // If it's the last method, throw the error
        if (method === methods[methods.length - 1]) {
          throw new Error(`Claude CLI error: ${error.message}`);
        }
        // Otherwise, continue to next method
        console.log(`  Method failed: ${error.message}`);
        continue;
      }
    }

    // If all methods failed or returned no summaries
    throw new Error('Failed to generate summaries from Claude CLI');
  }

  /**
   * Build the prompt for Claude
   * @param {Object} ticket - JIRA ticket object
   * @returns {string} Formatted prompt
   */
  buildPrompt(ticket) {
    const commentsText = ticket.comments.length > 0
      ? '\n\nComments:\n' + ticket.comments.map(c => `- ${c.author}: ${c.body}`).join('\n')
      : '';

    return `Given this JIRA ticket, generate one or more one-line summaries for API release notes.

Ticket:
Key: ${ticket.key}
Title: ${ticket.title}
Description: ${ticket.description || '(No description)'}${commentsText}

Format each summary as: **API Name**: description

Requirements:
- Each summary should be concise and follow the existing release notes style
- Extract the API name from the ticket content (e.g., Expenses, Files, Matters, Users, Portal, Tags, FirmUsers, Webhooks, Contacts, Events, Invoices, Staff, Tasks, Memos, MatterTypes, Roles, Archives, Activities, BillingConfiguration, ReferralTypes, Stages, SubTasks, MatterItems, Layouts)
- One ticket may generate multiple summaries if it affects multiple APIs
- Use present tense and active voice
- Include technical details like field names in backticks when relevant
- Only return the formatted summaries, one per line, in the format: **API Name**: description

Example output:
- **Expenses**: Added \`costType\` field.
- **Files**: Added ability to retrieve file history.
- **Matters**: Added support for multiple attorneys on a matter.`;
  }

  /**
   * Parse Claude's response to extract summaries
   * @param {string} response - Claude's response text
   * @returns {Array<string>} Array of summary strings
   */
  parseSummaries(response) {
    const lines = response.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const summaries = [];
    
    for (const line of lines) {
      // Match lines that start with - or * followed by **API Name**: description
      const match = line.match(/^[-*]\s*\*\*([^*]+)\*\*:\s*(.+)$/);
      if (match) {
        summaries.push(line.replace(/^[-*]\s*/, '- '));
      } else if (line.startsWith('**') && line.includes('**:')) {
        // Handle format without leading dash
        summaries.push(`- ${line}`);
      }
    }

    // If no structured summaries found, try to extract from any markdown format
    if (summaries.length === 0) {
      const apiMatch = response.match(/\*\*([^*]+)\*\*:\s*([^\n]+)/g);
      if (apiMatch) {
        summaries.push(...apiMatch.map(m => `- ${m}`));
      }
    }

    return summaries.length > 0 ? summaries : [];
  }

  /**
   * Test if Claude CLI is available
   * @returns {Promise<boolean>} True if Claude CLI is available
   */
  async testAvailability() {
    try {
      await execa('claude', ['--version'], { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}
