# Obsidian Utilities

A collection of utilities for Obsidian including date insertion and issue tracking integration.

## Features

### Date Insertion
Automatically replaces date patterns with the current date in your notes.

**Supported patterns:**
- `{{today()}}` - Replaced with current date
- `today()` - Replaced with current date
- `@today` - Replaced with current date

**Examples:**
- `Meeting notes for {{today()}}` becomes `Meeting notes for 2025-09-01`
- `@today review` becomes `2025-09-01 review`

### Issue Tracking Integration
Search and link to issues from Jira and Bitbucket directly in your notes.

**Usage:**
- Type `[[JIRA:search term]]` to search for issues
- Type `[[JIRA:PROJ-123]]` (Jira) or `[[JIRA:#123]]` (Bitbucket) for specific tickets
- Use the "Search Issues" command (Ctrl+P) for manual search
- Click on issue links to open tickets in your browser

**Examples:**
- `[[JIRA:login bug]]` - Searches for issues containing "login bug" in both Jira and Bitbucket
- `[[JIRA:MU-123]]` - Creates a link to Jira ticket MU-123
- `[[JIRA:#456]]` - Creates a link to Bitbucket issue #456
- Result: `[[JIRA:MU-123 - Fix user login issue]]` (clickable link)

## Configuration

### Date Format

Configure your preferred date format in the plugin settings:

- `YYYY-MM-DD` (default): 2025-09-01
- `MM-DD-YYYY`: 09-01-2025
- `DD-MM-YYYY`: 01-09-2025
- `MM/DD/YYYY`: 09/01/2025
- `DD/MM/YYYY`: 01/09/2025

### Issue Tracking Settings

The plugin supports both Jira and Bitbucket integration using Atlassian API tokens.

**For Atlassian API Token (Recommended):**

1. Go to <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Create a new API token
3. Use this token for both Jira and Bitbucket integration

**Jira Configuration:**

1. **Jira URL**: Your Jira server URL (e.g., `https://yourcompany.atlassian.net`)
2. **Username/Email**: Your Atlassian username or email address
3. **API Token**: Your Atlassian API token
4. **Projects**: Optional comma-separated list of project keys to limit searches

**Bitbucket Configuration:**

1. **Workspace**: Your Bitbucket workspace name
2. **Repository**: Optional specific repository to search issues in
3. **Username/Email**: Same as Jira (uses Atlassian account)
4. **API Token**: Same as Jira (uses Atlassian token)

## Escaping

To prevent replacement, prefix patterns with a backslash:

- `\{{today()}}` outputs `{{today()}}`
- `\@today` outputs `@today`

## Commands

- **Insert Today's Date**: Manually insert the current date
- **Search Jira Issues**: Open Jira search modal

## Installation

1. Download the latest release
2. Extract the files to your Obsidian plugins folder
3. Enable the plugin in Obsidian settings
4. Configure your date format and Jira settings (optional)

## License

MIT License
