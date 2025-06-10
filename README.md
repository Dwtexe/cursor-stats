# Cursor Stats

<div align="center">

> A powerful Cursor extension that provides real-time monitoring of your Cursor subscription usage,
>
> including fast requests and usage-based pricing information.

#### [Features](#section-features) • [Screenshots](#section-screenshots) • [Configuration](#section-configuration) • [Commands](#section-commands) • [Installation](#section-install) • [Support](#-support)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Dwtexe.cursor-stats.svg?style=flat-square&label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=Dwtexe.cursor-stats) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/Dwtexe.cursor-stats.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=Dwtexe.cursor-stats) [![Rating](https://img.shields.io/visual-studio-marketplace/r/Dwtexe.cursor-stats.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=Dwtexe.cursor-stats)

</div>

<details id="section-features">
<summary style="cursor: pointer"><h2 style="display: inline">✨ Features</h2></summary>

#### Core Features

- 🚀 Real-time usage monitoring
- 👥 Team usage tracking
- 📊 Premium request analytics
- 💰 Usage-based pricing insights
- 🔄 Smart cooldown system
- 🔔 Intelligent notifications
- 💸 Spending alerts
- 💳 Mid-month payment tracking

#### Advanced Features

- 🎨 Customizable status bar
- 📈 Progress bar visualization
- 🌍 Multi-currency support
- 📝 Diagnostic reporting
- ⚡ Command palette integration
- 🌙 Cursor Nightly version support
- 🔄 GitHub release updates
- 🔒 Secure token management

#### 🔜 Upcoming Features

- 📊 Session-based request tracking
- 📈 Visual analytics dashboard
- 🎯 Project-specific monitoring
- 🎨 Enhanced statistics view
- ⚙️ Advanced customization options

</details>
<details id="section-screenshots">
<summary style="cursor: pointer"><h2 style="display: inline">📸 Screenshots</h2></summary>
<table align="center">
<tr>
<td width="50%" "><img src="https://github.com/user-attachments/assets/08b36e46-c8eb-4c39-8500-fc0caeb5399e" width="100%"/></td>
<td width="50%" "><img src="https://github.com/user-attachments/assets/27f344d2-a3f7-4c13-98f2-20fdbb315430" width="100%"/></td>
</tr>
<tr>
<td align="center" ">Default UI</td>
<td align="center" ">Custom Currency</td>
</tr>
<tr>
<td width="50%" "><img src="https://github.com/user-attachments/assets/8ab6a112-3183-4d39-92c0-0bdb79c7d621" width="100%"/></td>
<td width="50%" "><img src="https://github.com/user-attachments/assets/64a88004-96e6-4c24-83cd-bddfb1b7c969" width="100%"/></td>
</tr>
<tr>
<td align="center" ">Progress Bars</td>
<td align="center" ">Settings</td>
</tr>
</table>
</details>

<details id="section-configuration">
<summary style="cursor: pointer"><h2 style="display: inline">⚙️ Configuration</h2></summary>

| Setting | Description | Default |
|---------|-------------|---------|
| `cursorStats.enableLogging` | Enable detailed logging | `true` |
| `cursorStats.enableStatusBarColors` | Toggle colored status bar | `true` |
| `cursorStats.statusBarColorThresholds` | Customize status bar text color based on usage percentage | `Array of 14 color thresholds` |
| `cursorStats.enableAlerts` | Enable usage alerts | `true` |
| `cursorStats.usageAlertThresholds` | Percentage thresholds for usage alerts | `[10, 30, 50, 75, 90, 100]` |
| `cursorStats.showTotalRequests` | Show sum of all requests instead of only fast requests | `false` |
| `cursorStats.refreshInterval` | Update frequency (seconds) | `60` |
| `cursorStats.spendingAlertThreshold` | Spending alert threshold (in your selected currency) | `1` |
| `cursorStats.currency` | Custom currency conversion | `USD` |
| `cursorStats.showProgressBars` | Enable progress visualization | `false` |
| `cursorStats.progressBarLength` | Progress bar length (for progress visualization) | `10` |
| `cursorStats.progressBarWarningThreshold` | Percentage threshold for progress bar warning (yellow) | `50` |
| `cursorStats.progressBarCriticalThreshold` | Percentage threshold for progress bar critical (red) | `75` |
| `cursorStats.customDatabasePath` | Custom path to Cursor database | `""` |
| `cursorStats.excludeWeekends` | Exclude weekends from period progress and daily calculations | `false` |
| `cursorStats.showDailyRemaining` | Show estimated fast requests remaining per day | `false` |
| `cursorStats.language` | Language for extension interface and messages | `en` |
| `cursorStats.showChangelogOnUpdate` | Show changelog popup and update notifications when extension updates | `false` |

</details>

<details id="section-commands">
<summary style="cursor: pointer"><h2 style="display: inline">🔧 Commands</h2></summary>

| Command | Description |
|---------|-------------|
| `cursor-stats.refreshStats` | Manually refresh statistics |
| `cursor-stats.openSettings` | Open extension settings |
| `cursor-stats.setLimit` | Configure usage-based pricing settings |
| `cursor-stats.selectCurrency` | Change display currency |
| `cursor-stats.selectLanguage` | Select language for extension interface |
| `cursor-stats.createReport` | Generate diagnostic report |

</details>

<details id="section-install">
<summary style="cursor: pointer"><h2 style="display: inline">🚀 Installation</h2></summary>
  
#### VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+P` / `⌘P`
3. Run `ext install Dwtexe.cursor-stats`

Or install directly from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Dwtexe.cursor-stats)

#### Manual Installation

1. Download the latest `.vsix` from [Releases](https://github.com/Dwtexe/cursor-stats/releases)
2. Open Cursor
3. Press `Ctrl+Shift+P` / `⌘⇧P`
4. Run `Install from VSIX`
5. Select the downloaded file

</details>

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 💬 Support

- 🐛 [Report Issues](https://github.com/Dwtexe/cursor-stats/issues)
- 💡 [Feature Requests](https://github.com/Dwtexe/cursor-stats/issues/new)

## 💝 Donations

If you find this extension helpful, consider supporting its development:

<details>
<summary>Click to view donation options</summary>

### Buy Me A Coffee

<a href="https://www.buymeacoffee.com/dwtexe" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

### Binance

- **ID**: `39070620`

### USDT

- **Multi-Chain** (BEP20/ERC20/Arbitrum One/Optimism):

  ```
  0x88bfb527158387f8f74c5a96a0468615d06f3899
  ```

- **TRC20**:

  ```
  TPTnapCanmrsfcMVAyn4YiC6dLP8Wx1Czb
  ```

</details>

## 📄 License

[MIT](LICENSE) © Dwtexe

---

<div align="center">

Made with ❤️ by [Dwtexe](https://github.com/Dwtexe)

</div>
