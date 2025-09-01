import { App, Editor, Plugin, PluginSettingTab, Setting, TAbstractFile, SuggestModal, Notice } from 'obsidian';

interface TodayPluginSettings {
	dateFormat: string;
	jiraUrl: string;
	jiraUsername: string;
	jiraApiToken: string;
	jiraProjects: string;
	bitbucketWorkspace: string;
	bitbucketRepo: string;
	useAtlassianToken: boolean;
}

const DEFAULT_SETTINGS: TodayPluginSettings = {
	dateFormat: 'YYYY-MM-DD',
	jiraUrl: '',
	jiraUsername: '',
	jiraApiToken: '',
	jiraProjects: '',
	bitbucketWorkspace: '',
	bitbucketRepo: '',
	useAtlassianToken: true
}

interface JiraIssue {
	key: string;
	summary: string;
	url: string;
	status: string;
	priority: string;
}

class JiraClient {
	private baseUrl: string;
	private username: string;
	private apiToken: string;
	private cache: Map<string, JiraIssue[]> = new Map();
	private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

	constructor(baseUrl: string, username: string, apiToken: string) {
		this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
		this.username = username;
		this.apiToken = apiToken;
	}

	private getAuthHeaders(): Record<string, string> {
		const auth = btoa(`${this.username}:${this.apiToken}`);
		return {
			'Authorization': `Basic ${auth}`,
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		};
	}

	async searchIssues(searchTerm: string, projects?: string): Promise<JiraIssue[]> {
		if (!this.baseUrl || !this.username || !this.apiToken) {
			throw new Error('Jira credentials not configured');
		}

		// Check cache first
		const cacheKey = `${searchTerm}-${projects || ''}`;
		const cachedResult = this.cache.get(cacheKey);
		if (cachedResult) {
			return cachedResult;
		}

		try {
			let jql = '';
			
			// If searchTerm looks like a ticket key (PROJECT-123), search by key
			if (/^[A-Z]+-\d+$/i.test(searchTerm.trim())) {
				jql = `key = "${searchTerm.trim()}"`;
			} else {
				// Otherwise search in summary and description
				jql = `text ~ "${searchTerm}"`;
				
				// Add project filter if specified
				if (projects) {
					const projectList = projects.split(',').map(p => p.trim()).filter(p => p);
					if (projectList.length > 0) {
						jql += ` AND project in (${projectList.map(p => `"${p}"`).join(',')})`;
					}
				}
			}

			jql += ' ORDER BY updated DESC';

			const response = await fetch(`${this.baseUrl}/rest/api/2/search`, {
				method: 'POST',
				headers: this.getAuthHeaders(),
				body: JSON.stringify({
					jql: jql,
					maxResults: 10,
					fields: ['key', 'summary', 'status', 'priority']
				})
			});

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Jira authentication failed. Please check your credentials.');
				} else if (response.status === 403) {
					throw new Error('Jira access denied. Please check your permissions.');
				}
				throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const issues: JiraIssue[] = data.issues.map((issue: {
				key: string;
				fields: {
					summary: string;
					status?: { name: string };
					priority?: { name: string };
				};
			}) => ({
				key: issue.key,
				summary: issue.fields.summary,
				url: `${this.baseUrl}/browse/${issue.key}`,
				status: issue.fields.status?.name || 'Unknown',
				priority: issue.fields.priority?.name || 'Unknown'
			}));

			// Cache the results
			this.cache.set(cacheKey, issues);
			setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

			return issues;
		} catch (error) {
			console.error('Error searching Jira issues:', error);
			throw error;
		}
	}

	async getIssue(key: string): Promise<JiraIssue | null> {
		try {
			const issues = await this.searchIssues(key);
			return issues.find(issue => issue.key.toUpperCase() === key.toUpperCase()) || null;
		} catch (error) {
			console.error('Error getting Jira issue:', error);
			return null;
		}
	}
}

class BitbucketClient {
	private workspace: string;
	private repo: string;
	private username: string;
	private apiToken: string;
	private cache: Map<string, JiraIssue[]> = new Map();
	private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

	constructor(workspace: string, repo: string, username: string, apiToken: string) {
		this.workspace = workspace;
		this.repo = repo;
		this.username = username;
		this.apiToken = apiToken;
	}

	private getAuthHeaders(): Record<string, string> {
		const auth = btoa(`${this.username}:${this.apiToken}`);
		return {
			'Authorization': `Basic ${auth}`,
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		};
	}

	async searchIssues(searchTerm: string): Promise<JiraIssue[]> {
		if (!this.workspace || !this.username || !this.apiToken) {
			throw new Error('Bitbucket credentials not configured');
		}

		// Check cache first
		const cacheKey = searchTerm;
		const cachedResult = this.cache.get(cacheKey);
		if (cachedResult) {
			return cachedResult;
		}

		try {
			let url = `https://api.bitbucket.org/2.0/repositories/${this.workspace}`;
			
			if (this.repo) {
				// Search in specific repository issues
				url += `/${this.repo}/issues?q=`;
				
				// If searchTerm looks like an issue ID (#123), search by ID
				if (/^#?\d+$/.test(searchTerm.trim())) {
					const issueId = searchTerm.replace('#', '');
					url += `id=${issueId}`;
				} else {
					// Search in title and content
					url += `title~"${searchTerm}" OR content~"${searchTerm}"`;
				}
			} else {
				// If no specific repo, we'll need to list repos first
				throw new Error('Repository name is required for Bitbucket integration');
			}

			url += '&sort=-updated_on&pagelen=10';

			const response = await fetch(url, {
				method: 'GET',
				headers: this.getAuthHeaders()
			});

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Bitbucket authentication failed. Please check your credentials.');
				} else if (response.status === 403) {
					throw new Error('Bitbucket access denied. Please check your permissions.');
				}
				throw new Error(`Bitbucket API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const issues: JiraIssue[] = (data.values || []).map((issue: {
				id: number;
				title: string;
				state: string;
				priority: string;
				links: { html: { href: string } };
			}) => ({
				key: `#${issue.id}`,
				summary: issue.title,
				url: issue.links.html.href,
				status: issue.state || 'open',
				priority: issue.priority || 'normal'
			}));

			// Cache the results
			this.cache.set(cacheKey, issues);
			setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

			return issues;
		} catch (error) {
			console.error('Error searching Bitbucket issues:', error);
			throw error;
		}
	}

	async getIssue(id: string): Promise<JiraIssue | null> {
		try {
			const issues = await this.searchIssues(id);
			return issues.find(issue => issue.key === `#${id.replace('#', '')}`) || null;
		} catch (error) {
			console.error('Error getting Bitbucket issue:', error);
			return null;
		}
	}
}

class JiraSearchModal extends SuggestModal<JiraIssue> {
	private jiraClient: JiraClient | null;
	private bitbucketClient: BitbucketClient | null;
	private searchTerm: string;
	private onSelectCallback: (issue: JiraIssue) => void;

	constructor(app: App, jiraClient: JiraClient | null, bitbucketClient: BitbucketClient | null, searchTerm: string, onSelect: (issue: JiraIssue) => void) {
		super(app);
		this.jiraClient = jiraClient;
		this.bitbucketClient = bitbucketClient;
		this.searchTerm = searchTerm;
		this.onSelectCallback = onSelect;
		this.setPlaceholder('Search issues...');
	}

	async getSuggestions(query: string): Promise<JiraIssue[]> {
		const actualSearchTerm = query || this.searchTerm;
		if (!actualSearchTerm) {
			return [];
		}

		const results: JiraIssue[] = [];

		// Search Jira if available
		if (this.jiraClient) {
			try {
				const jiraIssues = await this.jiraClient.searchIssues(actualSearchTerm);
				results.push(...jiraIssues);
			} catch (error) {
				console.error('Error searching Jira:', error);
			}
		}

		// Search Bitbucket if available
		if (this.bitbucketClient) {
			try {
				const bitbucketIssues = await this.bitbucketClient.searchIssues(actualSearchTerm);
				results.push(...bitbucketIssues);
			} catch (error) {
				console.error('Error searching Bitbucket:', error);
			}
		}

		return results;
	}

	renderSuggestion(issue: JiraIssue, el: HTMLElement): void {
		el.createEl('div', { text: issue.key, cls: 'jira-issue-key' });
		el.createEl('div', { text: issue.summary, cls: 'jira-issue-summary' });
		el.createEl('small', { text: `${issue.status} • ${issue.priority}`, cls: 'jira-issue-meta' });
	}

	onChooseSuggestion(issue: JiraIssue): void {
		this.onSelectCallback(issue);
	}
}

export default class TodayPlugin extends Plugin {
	settings: TodayPluginSettings;
	private jiraClient: JiraClient | null = null;
	private bitbucketClient: BitbucketClient | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize Jira client if credentials are available
		this.initializeJiraClient();

		// Register event listener for editor changes
		this.registerEvent(this.app.workspace.on('editor-change', this.handleEditorChange.bind(this)));

		// Register event listener for file rename (for title editing)
		this.registerEvent(this.app.vault.on('rename', this.handleFileRename.bind(this)));

		// Add command to insert today's date
		this.addCommand({
			id: 'insert-today-date',
			name: 'Insert Today\'s Date',
			editorCallback: (editor: Editor) => {
				const today = this.formatDate(new Date());
				editor.replaceSelection(today);
			}
		});

		// Add command to search Jira issues
		this.addCommand({
			id: 'search-jira-issues',
			name: 'Search Jira Issues',
			editorCallback: (editor: Editor) => {
				this.showJiraSearchModal(editor);
			}
		});

		// Register link click handler for Jira links
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			this.handleLinkClick(evt);
		});

		// Add settings tab
		this.addSettingTab(new TodayPluginSettingTab(this.app, this));
	}

	initializeJiraClient() {
		// Initialize Jira client
		if (this.settings.jiraUrl && this.settings.jiraUsername && this.settings.jiraApiToken) {
			this.jiraClient = new JiraClient(
				this.settings.jiraUrl,
				this.settings.jiraUsername,
				this.settings.jiraApiToken
			);
		} else {
			this.jiraClient = null;
		}

		// Initialize Bitbucket client
		if (this.settings.bitbucketWorkspace && this.settings.jiraUsername && this.settings.jiraApiToken) {
			this.bitbucketClient = new BitbucketClient(
				this.settings.bitbucketWorkspace,
				this.settings.bitbucketRepo,
				this.settings.jiraUsername,
				this.settings.jiraApiToken
			);
		} else {
			this.bitbucketClient = null;
		}
	}

	private showJiraSearchModal(editor: Editor) {
		if (!this.jiraClient && !this.bitbucketClient) {
			// Show error message
			new Notice('No issue tracking integration configured. Please check your settings.', 5000);
			return;
		}

		const modal = new JiraSearchModal(this.app, this.jiraClient, this.bitbucketClient, '', (issue: JiraIssue) => {
			const linkText = `[[JIRA:${issue.key} - ${issue.summary}]]`;
			editor.replaceSelection(linkText);
		});
		modal.open();
	}

	private async expandJiraLink(editor: Editor, lineNum: number, match: RegExpMatchArray, searchTerm: string) {
		if (!this.jiraClient) return;

		try {
			// Show loading indicator
			const line = editor.getLine(lineNum);
			const loadingLine = line.replace(match[0], `[[JIRA:${searchTerm} (searching...)]]`);
			editor.setLine(lineNum, loadingLine);

			const issues = await this.jiraClient.searchIssues(searchTerm);
			if (issues.length > 0) {
				// If exact match found, use it; otherwise use first result
				const issue = issues.find(i => i.key.toLowerCase() === searchTerm.toLowerCase()) || issues[0];
				const expandedLine = line.replace(match[0], `[[JIRA:${issue.key} - ${issue.summary}]]`);
				editor.setLine(lineNum, expandedLine);
			} else {
				// No results found, revert to original
				editor.setLine(lineNum, line);
				new Notice(`No Jira issues found for "${searchTerm}"`);
			}
		} catch (error) {
			console.error('Error expanding Jira link:', error);
			// Revert to original line
			const originalLine = editor.getLine(lineNum);
			editor.setLine(lineNum, originalLine);
			new Notice('Error searching Jira issues. Please check your connection.');
		}
	}

	private handleLinkClick(evt: MouseEvent) {
		const target = evt.target as HTMLElement;
		
		// Check if clicked element is a Jira link
		if (target.classList.contains('internal-link') || target.closest('.internal-link')) {
			const linkElement = target.classList.contains('internal-link') ? target : target.closest('.internal-link');
			const linkText = linkElement?.getAttribute('data-href') || linkElement?.textContent || '';
			
			// Check if it's a Jira link
			const jiraMatch = linkText.match(/^JIRA:([A-Z]+-\d+)/i);
			if (jiraMatch && this.jiraClient) {
				evt.preventDefault();
				evt.stopPropagation();
				
				const ticketKey = jiraMatch[1];
				const jiraUrl = `${this.settings.jiraUrl}/browse/${ticketKey}`;
				window.open(jiraUrl, '_blank');
			}
		}
	}

	private handleEditorChange(editor: Editor, _info: unknown) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// Handle Jira link pattern [[JIRA:search term]]
		if (this.jiraClient) {
			const jiraPattern = /\[\[JIRA:([^\]]+)\]\]/;
			const match = line.match(jiraPattern);
			if (match && match.index !== undefined) {
				const matchStart = match.index;
				const matchEnd = matchStart + match[0].length;
				
				// Check if cursor is within the match
				if (cursor.ch >= matchStart && cursor.ch <= matchEnd) {
					const searchTerm = match[1].trim();
					
					// If it looks like a complete ticket (PROJ-123 format), try to expand it
					if (/^[A-Z]+-\d+( - .*)?$/i.test(searchTerm)) {
						return; // Already expanded or in final form
					}
					
					// If user just finished typing (check if they pressed space or bracket)
					const lastChar = line[cursor.ch - 1];
					if (lastChar === ']' || lastChar === ' ') {
						this.expandJiraLink(editor, cursor.line, match, searchTerm);
						return;
					}
				}
			}
		}

		// First, handle escaped patterns (remove the backslash)
		const escapePatterns = [
			{ regex: /\\(\{\{today\(\)\}\})/g, replacement: '$1' },
			{ regex: /\\(today\(\))/g, replacement: '$1' },
			{ regex: /\\(@today)\b/g, replacement: '$1' }
		];

		for (const pattern of escapePatterns) {
			if (pattern.regex.test(line)) {
				const newLine = line.replace(pattern.regex, pattern.replacement);
				editor.setLine(cursor.line, newLine);

				// Adjust cursor position (removing one backslash)
				const newCursorPos = Math.max(0, cursor.ch - 1);
				editor.setCursor(cursor.line, newCursorPos);
				return; // Exit early to avoid processing date replacement
			}
		}

		// Then handle normal date patterns (only if no escape patterns were found)
		const datePatterns = [
			{ regex: /\{\{today\(\)\}\}/g, replacement: this.formatDate(new Date()) },
			{ regex: /\btoday\(\)/g, replacement: this.formatDate(new Date()) },
			{ regex: /@today\b/g, replacement: this.formatDate(new Date()) }
		];

		for (const pattern of datePatterns) {
			const matches = [...line.matchAll(pattern.regex)];
			if (matches.length > 0) {
				// Check if any match is preceded by a backslash
				const validMatches = matches.filter(match => {
					const matchStart = match.index ?? 0;
					return matchStart === 0 || line[matchStart - 1] !== '\\';
				});

				if (validMatches.length === 0) continue;

				let newLine = line;
				let cursorAdjustment = 0;

				// Process valid matches from right to left to maintain correct positions
				for (let i = validMatches.length - 1; i >= 0; i--) {
					const match = validMatches[i];
					const matchStart = match.index ?? 0;
					const matchEnd = matchStart + match[0].length;

					newLine = newLine.substring(0, matchStart) +
						pattern.replacement +
						newLine.substring(matchEnd);

					// Calculate cursor adjustment for the match that contains the cursor
					if (matchStart <= cursor.ch && cursor.ch <= matchEnd) {
						// Cursor is within this match - position it at the end of the replacement
						cursorAdjustment = (matchStart + pattern.replacement.length) - cursor.ch;
					} else if (matchStart < cursor.ch) {
						// Match is before cursor - adjust for length difference
						cursorAdjustment += pattern.replacement.length - match[0].length;
					}
				}

				// Replace the entire line
				editor.setLine(cursor.line, newLine);

				// Move cursor to correct position after replacement
				const newCursorPos = Math.max(0, cursor.ch + cursorAdjustment);
				editor.setCursor(cursor.line, newCursorPos);

				break; // Only process the first matching pattern
			}
		}
	}

	private async handleFileRename(file: TAbstractFile, oldPath: string) {
		// Check if the new filename contains today patterns
		let newName = file.name;
		let hasReplacement = false;

		// First handle escaped patterns (remove backslash)
		const escapePatterns = [
			{ regex: /\\(\{\{today\(\)\}\})/, replacement: '$1' },
			{ regex: /\\(today\(\))/, replacement: '$1' },
			{ regex: /\\(@today)\b/, replacement: '$1' }
		];

		for (const pattern of escapePatterns) {
			if (pattern.regex.test(newName)) {
				newName = newName.replace(pattern.regex, pattern.replacement);
				hasReplacement = true;
				break;
			}
		}

		// If no escape patterns, check for normal date patterns
		if (!hasReplacement) {
			const datePatterns = [
				{ regex: /\{\{today\(\)\}\}/, replacement: this.formatDate(new Date()) },
				{ regex: /\btoday\(\)/, replacement: this.formatDate(new Date()) },
				{ regex: /@today\b/, replacement: this.formatDate(new Date()) }
			];

			for (const pattern of datePatterns) {
				// Check if pattern exists and is not escaped
				const match = newName.match(pattern.regex);
				if (match && match.index !== undefined) {
					const matchStart = match.index;
					const isEscaped = matchStart > 0 && newName[matchStart - 1] === '\\';

					if (!isEscaped) {
						newName = newName.replace(pattern.regex, pattern.replacement);
						hasReplacement = true;
						break;
					}
				}
			}
		}

		if (hasReplacement) {
			const newPath = file.path.replace(file.name, newName);
			try {
				await this.app.vault.rename(file, newPath);
			} catch (error) {
				console.error('Failed to rename file:', error);
			}
		}
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		switch (this.settings.dateFormat) {
			case 'MM-DD-YYYY':
				return `${month}-${day}-${year}`;
			case 'DD-MM-YYYY':
				return `${day}-${month}-${year}`;
			case 'MM/DD/YYYY':
				return `${month}/${day}/${year}`;
			case 'DD/MM/YYYY':
				return `${day}/${month}/${year}`;
			case 'YYYY-MM-DD':
			default:
				return `${year}-${month}-${day}`;
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TodayPluginSettingTab extends PluginSettingTab {
	plugin: TodayPlugin;

	constructor(app: App, plugin: TodayPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Today Plugin Settings'});

		new Setting(containerEl)
			.setName('Date Format')
			.setDesc('Choose the format for the date when {{today()}} is replaced')
			.addDropdown(dropdown => dropdown
				.addOption('YYYY-MM-DD', 'YYYY-MM-DD (2023-09-01)')
				.addOption('MM-DD-YYYY', 'MM-DD-YYYY (09-01-2023)')
				.addOption('DD-MM-YYYY', 'DD-MM-YYYY (01-09-2023)')
				.addOption('MM/DD/YYYY', 'MM/DD/YYYY (09/01/2023)')
				.addOption('DD/MM/YYYY', 'DD/MM/YYYY (01/09/2023)')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));

		// Jira Integration Settings
		containerEl.createEl('h3', {text: 'Issue Tracking Integration'});

		new Setting(containerEl)
			.setName('Use Atlassian Token')
			.setDesc('Use the same API token for both Jira and Bitbucket (recommended)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useAtlassianToken)
				.onChange(async (value) => {
					this.plugin.settings.useAtlassianToken = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings display
				}));

		new Setting(containerEl)
			.setName('Username/Email')
			.setDesc('Your Atlassian username or email address')
			.addText(text => text
				.setPlaceholder('your.email@company.com')
				.setValue(this.plugin.settings.jiraUsername)
				.onChange(async (value) => {
					this.plugin.settings.jiraUsername = value;
					await this.plugin.saveSettings();
					this.plugin.initializeJiraClient();
				}));

		new Setting(containerEl)
			.setName('API Token')
			.setDesc('Your Atlassian API token. Create one at: https://id.atlassian.com/manage-profile/security/api-tokens')
			.addText(text => {
				text.inputEl.type = 'password';
				return text
					.setPlaceholder('Your API token')
					.setValue(this.plugin.settings.jiraApiToken)
					.onChange(async (value) => {
						this.plugin.settings.jiraApiToken = value;
						await this.plugin.saveSettings();
						this.plugin.initializeJiraClient();
					});
			});

		// Jira-specific settings
		containerEl.createEl('h4', {text: 'Jira Settings'});

		new Setting(containerEl)
			.setName('Jira URL')
			.setDesc('Your Jira server URL (e.g., https://yourcompany.atlassian.net)')
			.addText(text => text
				.setPlaceholder('https://yourcompany.atlassian.net')
				.setValue(this.plugin.settings.jiraUrl)
				.onChange(async (value) => {
					this.plugin.settings.jiraUrl = value;
					await this.plugin.saveSettings();
					this.plugin.initializeJiraClient();
				}));

		new Setting(containerEl)
			.setName('Jira Projects')
			.setDesc('Optional: Comma-separated list of project keys to limit searches (e.g., PROJ,TASK)')
			.addText(text => text
				.setPlaceholder('PROJ,TASK,BUG')
				.setValue(this.plugin.settings.jiraProjects)
				.onChange(async (value) => {
					this.plugin.settings.jiraProjects = value;
					await this.plugin.saveSettings();
				}));

		// Bitbucket-specific settings
		containerEl.createEl('h4', {text: 'Bitbucket Settings'});

		new Setting(containerEl)
			.setName('Bitbucket Workspace')
			.setDesc('Your Bitbucket workspace name (e.g., yourcompany)')
			.addText(text => text
				.setPlaceholder('yourcompany')
				.setValue(this.plugin.settings.bitbucketWorkspace)
				.onChange(async (value) => {
					this.plugin.settings.bitbucketWorkspace = value;
					await this.plugin.saveSettings();
					this.plugin.initializeJiraClient();
				}));

		new Setting(containerEl)
			.setName('Bitbucket Repository')
			.setDesc('Optional: Specific repository name to search issues in')
			.addText(text => text
				.setPlaceholder('my-project')
				.setValue(this.plugin.settings.bitbucketRepo)
				.onChange(async (value) => {
					this.plugin.settings.bitbucketRepo = value;
					await this.plugin.saveSettings();
					this.plugin.initializeJiraClient();
				}));

		// Usage instructions
		const usageEl = containerEl.createEl('div', {cls: 'jira-usage-instructions'});
		usageEl.createEl('h4', {text: 'Usage Instructions'});
		usageEl.createEl('p', {text: '1. Type [[JIRA:search term]] to search for issues'});
		usageEl.createEl('p', {text: '2. Type [[JIRA:PROJ-123]] (Jira) or [[JIRA:#123]] (Bitbucket) for specific tickets'});
		usageEl.createEl('p', {text: '3. Use the "Search Jira Issues" command (Ctrl+P) for manual search'});
		usageEl.createEl('p', {text: '4. Click on issue links to open tickets in your browser'});
		usageEl.createEl('p', {text: '5. Configure either Jira, Bitbucket, or both for comprehensive search'});
	}
}
