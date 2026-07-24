#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { JiraClient } from './lib/jira-client.js';
import { ClaudeClient } from './lib/claude-client.js';
import { SummaryFormatter } from './lib/summary-formatter.js';
import { MdxParser } from './lib/mdx-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('update-release-notes')
  .description('Update API release notes from JIRA tickets using Claude CLI')
  .requiredOption('--fix-version <version>', 'JIRA fix version to filter by (e.g., "SB-9.15")')
  .option('-f, --file <path>', 'Release notes file path', '../docs/api-docs/98439555e1d41-release-notes.mdx')
  .option('-c, --config <path>', 'JIRA config file path', 'jira-config.json')
  .option('-m, --months <number>', 'Number of months to look back', '3')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-5')
  .parse(process.argv);

const options = program.opts();

// Validate fix-version is provided
if (!options.fixVersion) {
  console.error('❌ Error: --fix-version parameter is required');
  program.help();
  process.exit(1);
}

/**
 * Load JIRA configuration from file
 */
async function loadJiraConfig(configPath) {
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (!config.url || !config.username || !config.apiToken) {
      throw new Error('JIRA config must contain url, username, and apiToken');
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`JIRA config file not found: ${configPath}`);
    }
    throw new Error(`Failed to load JIRA config: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting release notes update...\n');

    // Load configuration
    const configPath = path.resolve(process.cwd(), options.config);
    console.log(`📋 Loading JIRA config from: ${configPath}`);
    const jiraConfig = await loadJiraConfig(configPath);

    // Initialize clients
    const jiraClient = new JiraClient(jiraConfig);
    const claudeClient = new ClaudeClient(options.model);
    const formatter = new SummaryFormatter();
    const mdxParser = new MdxParser();

    // Test connections
    console.log('🔌 Testing JIRA connection...');
    const jiraConnected = await jiraClient.testConnection();
    if (!jiraConnected) {
      throw new Error('Failed to connect to JIRA. Please check your credentials.');
    }
    console.log('✅ JIRA connection successful\n');

    console.log('🔌 Testing Claude CLI availability...');
    const claudeAvailable = await claudeClient.testAvailability();
    if (!claudeAvailable) {
      throw new Error('Claude CLI is not available. Please install it first.');
    }
    console.log('✅ Claude CLI is available\n');

    // Query JIRA tickets
    const monthsBack = parseInt(options.months, 10);
    const fixVersion = options.fixVersion;
    
    console.log(`🔍 Querying JIRA for API tickets with fix version "${fixVersion}" from the last ${monthsBack} months...`);
    const tickets = await jiraClient.getApiTickets(monthsBack, fixVersion);
    console.log(`📝 Found ${tickets.length} ticket(s)\n`);

    if (tickets.length === 0) {
      console.log('ℹ️  No tickets found. Nothing to update.');
      return;
    }

    // Generate summaries for each ticket
    console.log('🤖 Generating summaries with Claude...');
    const allSummaries = [];
    
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      console.log(`  Processing ticket ${i + 1}/${tickets.length}: ${ticket.key} - ${ticket.title}`);
      
      try {
        const summaries = await claudeClient.generateSummaries(ticket);
        if (summaries.length > 0) {
          allSummaries.push(...summaries);
          console.log(`    ✓ Generated ${summaries.length} summary(ies)`);
        } else {
          console.log(`    ⚠ No summaries generated`);
        }
      } catch (error) {
        console.error(`    ✗ Error generating summaries: ${error.message}`);
      }
    }

    if (allSummaries.length === 0) {
      console.log('\n⚠️  No summaries were generated. Nothing to update.');
      return;
    }

    // Format and sort summaries
    console.log('\n📊 Formatting and sorting summaries...');
    const deduplicated = formatter.deduplicate(allSummaries);
    const sorted = formatter.formatAndSort(deduplicated);
    console.log(`✓ Processed ${sorted.length} unique summary(ies)\n`);

    // Update MDX file
    const filePath = path.resolve(process.cwd(), options.file);
    console.log(`📄 Reading release notes file: ${filePath}`);
    const parsed = await mdxParser.readFile(filePath);

    const monthLabel = mdxParser.getCurrentMonthLabel();
    console.log(`📅 Using month label: ${monthLabel}\n`);

    console.log('💾 Writing updated release notes...');
    await mdxParser.writeFile(filePath, parsed, monthLabel, sorted);
    console.log('✅ Release notes updated successfully!');
    console.log(`📦 Backup saved to: ${filePath}.backup\n`);

    console.log('✨ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
