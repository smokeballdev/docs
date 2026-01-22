# Release Notes Update Script

This script automates the generation of API release notes by querying JIRA tickets and using Claude CLI to generate standardized summaries.

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **Claude CLI** installed and configured
3. **JIRA API Token** - Generate one at: https://id.atlassian.com/manage-profile/security/api-tokens

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create JIRA configuration file:
```bash
cp jira-config.json.example jira-config.json
```

3. Edit `jira-config.json` with your JIRA credentials:
```json
{
  "url": "https://your-jira-instance.atlassian.net",
  "username": "your-email@example.com",
  "apiToken": "your-jira-api-token"
}
```

## Usage

```bash
npm run update-release-notes -- --file "docs/api-docs/98439555e1d41-release-notes.mdx" --months 2
```

Or directly:
```bash
node scripts/update-release-notes.js --file "docs/api-docs/98439555e1d41-release-notes.mdx" --months 2
```

### Options

- `--file, -f`: Release notes file path (default: `docs/api-docs/98439555e1d41-release-notes.mdx`)
- `--config, -c`: JIRA config file path (default: `jira-config.json`)
- `--months, -m`: Number of months to look back (default: `2`)
- `--model`: Claude model to use (default: `claude-sonnet-4-20250514`)

## How It Works

1. Queries JIRA for tickets with:
   - Label: `API`
   - Status: `Dev Live Testing`, `Live QA`, or `Completed`
   - Updated or resolved within the specified number of months

2. For each ticket, uses Claude CLI (Sonnet 4.5) to generate one or more one-line summaries in the format:
   ```
   - **API Name**: description
   ```

3. Groups summaries by API name and sorts them alphabetically

4. Inserts a new `<Update>` entry at the top of the release notes file with the current month/year

5. Creates a backup of the original file before making changes

## Example Output

The script will generate entries like:

```mdx
<Update label="December 2025">
- **Expenses**: Added `costType` field.
- **Files**: Added ability to retrieve file history.
- **Matters**: Added support for multiple attorneys on a matter.
- **Users**: Added `bypassMfa` field.
</Update>
```

## Troubleshooting

- **JIRA connection fails**: Verify your credentials in `jira-config.json`
- **Claude CLI not found**: Ensure Claude CLI is installed and in your PATH
- **No summaries generated**: Check that tickets have sufficient information for Claude to extract API changes
