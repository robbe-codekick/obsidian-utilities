# Today Date Plugin for Obsidian

This plugin automatically replaces date patterns with the current date when you type them in your notes or file names.

## Features

- **Multiple Date Patterns**: Choose from different ways to insert today's date:
  - `{{today()}}` - Template-style (traditional)
  - `today()` - Function-style (simpler)
  - `@today` - Tag-style (quickest)
- **Escaping Mechanism**: Use a backslash `\` to prevent replacement:
  - `\{{today()}}` → `{{today()}}` (literal text, no replacement)
  - `\today()` → `today()` (literal text, no replacement)
  - `\@today` → `@today` (literal text, no replacement)
- **Smart Cursor Positioning**: After replacement, your cursor automatically moves to the end of the inserted date
- **File Name Support**: Works when renaming files/notes - type any pattern in the filename and it gets replaced
- **Multiple Date Formats**: Choose from various date formats in the plugin settings:
  - YYYY-MM-DD (2023-09-01) - Default
  - MM-DD-YYYY (09-01-2023)
  - DD-MM-YYYY (01-09-2023)
  - MM/DD/YYYY (09/01/2023)
  - DD/MM/YYYY (01/09/2023)
- **Manual Command**: Use the "Insert Today's Date" command to manually insert the current date
- **Settings**: Configure your preferred date format in the plugin settings

## How to Use

### In Note Content

1. Install and enable the plugin in Obsidian
2. Create a new note or open an existing one
3. Type any of these patterns:
   - `{{today()}}` → `2025-09-01`
   - `today()` → `2025-09-01`
   - `@today` → `2025-09-01`
4. The text will automatically be replaced and your cursor will be positioned after the date
5. To prevent replacement (for documentation or examples), use a backslash escape:
   - `\{{today()}}` → `{{today()}}` (no replacement)
   - `\today()` → `today()` (no replacement)
   - `\@today` → `@today` (no replacement)
6. You can also use the Command Palette (Ctrl/Cmd + P) and search for "Insert Today's Date"

### In File Names
1. When renaming a note/file, include any of the patterns in the new name
2. For example: `Meeting Notes today().md` becomes `Meeting Notes 2025-09-01.md`
3. Works with all supported patterns: `{{today()}}`, `today()`, `@today`

## Settings

Go to Settings → Community plugins → Today Date Plugin to configure:

- **Date Format**: Choose your preferred date format from the dropdown

## Development

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
