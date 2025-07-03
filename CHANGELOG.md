# Change Log

All notable changes to the "cursor-stats" extension will be documented in this file.

## [1.1.5] - 2025-07-03

### Added
- 🔄 **Hybrid Data Collection**: Smart combination of team spend and individual usage APIs for comprehensive statistics
- 📊 **Enhanced Model Breakdown**: Detailed tooltip showing usage across all AI models with proper labeling
  - GPT-4 (Premium/Fast): Fast premium requests
  - GPT-4-32k (Usage-Based): Usage-based spending limit  
  - GPT-3.5-turbo: Legacy model
- 🔍 **Team vs Individual Comparison**: Clear distinction between team usage and individual usage for team members
- 🎯 **Improved API Logic**: Better understanding of usage-based spending limits from GPT-4-32k data

### Changed
- 🔧 **API Endpoint Migration**: Replaced deprecated `get-team-usage` with `get-team-spend` endpoint
- 📈 **Data Source Priority**: Team members now get team-specific usage data while maintaining individual context
- 💡 **Usage-Based Limit Detection**: GPT-4-32k `maxRequestUsage` now properly represents usage-based spending limits
- 🏷️ **Model Labeling**: Enhanced model names with descriptive labels for better user understanding
- 🔄 **Fallback Mechanism**: Automatic fallback to individual usage API if team APIs fail

### Fixed
- 🐛 **Missing Request Limits**: Resolved issue where team spend data lacked `maxRequestUsage` by combining with individual usage API
- 🎯 **Data Accuracy**: Improved accuracy for team members by using team-specific usage data
- 📊 **Status Bar Display**: Better alignment between dashboard data and extension display
- 🔧 **Error Handling**: Enhanced error handling for API endpoint transitions
- 🚨 **CRITICAL: Usage-Based Pricing Detection**: Fixed inconsistent usage-based pricing status detection for team members
  - Backend correctly detected team usage-based pricing as enabled
  - UI tooltip incorrectly showed "disabled" due to missing team context
  - Fixed by ensuring tooltip uses team-aware API calls with proper teamId parameter
  - Resolves issue where $250 usage-based pricing showed as "disabled" in tooltip despite being active

## [1.1.4] - 2025-06-06

### Added
- 🌍 **Internationalization (i18n) Support**: Extension interface now supports multiple languages
  - English (Default)
  - 中文 (Chinese) 
  - 한국어 (Korean)
- 🔧 **Language Selection**: New command "Cursor Stats: Select Language" for easy language switching

### Changed
- 🌐 All UI elements, notifications, and messages are now translatable
- 📈 Status bar and tooltips adapt to selected language
- 💰 Currency names are now localized based on selected language
- 🔄 Automatic interface updates when language is changed

### Fixed
- 🐛 Fixed undefined requests handling in team usage extraction
- 🎯 Improved usage-based pricing period calculations for active months
- 🔧 Better error handling for localization edge cases

## Upcoming Features

### Planned

- Session based request tracking
- Visual analytics with graphs for historical request usage
- Project-specific request usage monitoring
- Dedicated activity bar section for enhanced statistics view
- Smart API error handling with exponential backoff
  - Automatic retry reduction during API outages
  - Intelligent refresh rate adjustment
  - User-friendly error notifications
- Customization features:
  - Configurable quota display options
  - Hide/show specific model statistics
  - Customizable status bar information

## [1.1.3] - 2024-07-27

### Reverted
- ⏪ Reverted the SQLite library change introduced in `v1.1.2` (from `node-sqlite3-wasm` back to `sql.js`). This addresses critical token retrieval errors experienced by some users, particularly on Macos.

### Fixed
- 🐛 Fixed an issue where some users could not retrieve their access token after the `v1.1.2` update due to the new SQLite library.

## [1.1.2] - 2025-05-23

### Added
- ✨ Enhanced spending alert notifications to trigger for each multiple of the configured threshold, providing more granular warnings.
- 📊 Added "Daily Remaining" feature: Shows estimated fast requests remaining per day in the tooltip.
  - Includes new settings: `cursorStats.showDailyRemaining` and `cursorStats.excludeWeekends`.
- 🚀 Changelog Display on Update: The extension now automatically shows the changelog in a webview panel when it's updated to a new version.

### Changed
- 🔧 Switched from `sql.js` to `node-sqlite3-wasm` for SQLite database handling. This change addresses potential issues with large database files (over 2GB) and improves cross-platform compatibility by using a more robust WASM-based SQLite implementation.
- 💅 Improved tooltip formatting for usage-based pricing details, including better alignment and padding for costs and model names.
- 🛠 Refined detection and notification logic for unknown AI models in usage data.
- ⚙️ Spending alert notifications are now reset and re-evaluated if the `spendingAlertThreshold` setting is changed.

### Fixed
- 🐛 Corrected an issue where mid-month payment amounts in tooltips might not always reflect the user's selected currency.
- 🐞 Addressed potential minor inaccuracies in progress bar calculations when "exclude weekends" was enabled.

## [1.1.1] - 2025-05-01

### Added
- 🎨 Added a new setting `cursorStats.statusBarColorThresholds` to allow customizing status bar text color based on usage percentage thresholds.

### Changed
- ✨ Improved usage-based pricing calculations to more accurately reflect costs, particularly by excluding mid-month payment credits from total cost and usage percentage calculations.
- 📊 Modified the tooltip display to filter out the mid-month payment item from the detailed list and clarify the unpaid amount calculation.
- 🔎 Enhanced detection and display of potentially unknown models in the usage details tooltip.
- 🧹 Removed minor redundant log statements.

## [1.1.0] - 2025-04-22

### Added
- 🌍 Multi-currency support
- 📊 Progress bar visualization for usage and period tracking
- 📝 Diagnostic report generation for troubleshooting
- 🎨 Enhanced tooltips with improved formatting and clarity
- ⚙️ Custom database path configuration option
- 🔄 Improved model detection and notifications
- 📈 Better usage statistics presentation
- 💡 Smart progress bars with configurable thresholds

### Changed
- Refactored currency handling with real-time conversion
- Enhanced tooltip display with centered alignment
- Improved error handling and notifications
- Updated usage tracking for new AI models
- Enhanced status bar information display
- Better organization of configuration options
- Optimized performance for currency conversions

### Fixed
- Currency display formatting issues
- Progress bar threshold calculations
- Model detection accuracy
- Usage percentage calculations
- Status bar update timing
- Configuration change handling

## [1.0.9] - 2025-02-15

### Added
- Team usage support with per-user statistics tracking
- Enhanced cooldown mechanism for API request management
- Improved window focus handling for better performance
- Smart interval management for status updates
- Comprehensive error handling with detailed logging

### Changed
- Refactored extension activation and update logic
- Enhanced team usage API with team ID support
- Improved notification system with better timing
- Updated status bar refresh mechanism
- Optimized performance during window focus changes

### Fixed
- Window focus handling during cooldown periods
- Status bar update timing issues
- Team usage data synchronization
- API request throttling and cooldown logic
- Memory usage optimization

## [1.0.8] - 2025-02-08

### Added
- Spending alert notifications with configurable dollar thresholds
- UI extension host compatibility for remote development
- New `spendingAlertThreshold` configuration option
- Multi-threshold alert system (6 default percentage thresholds)

### Changed
- Configuration structure now uses array-based format
- Increased default refresh interval from 30 to 60 seconds
- Raised minimum refresh interval from 5 to 10 seconds
- Added "scope" property to all configuration settings
- Updated notification sorting logic to handle more thresholds

### Removed
- Legacy VSIX package file from repository

## [1.0.7] - 2025-02-07

### Added
- Comprehensive GitHub release notes viewer with markdown support
- Enhanced release check functionality with detailed release information
- Support for release assets and source code download links
- Integrated marked library for markdown rendering
- Improved WSL database path handling

### Changed
- Updated status bar color scheme for better visual consistency
- Refactored Windows username utility into database service
- Enhanced usage cost display formatting
- Improved release information structure with additional metadata
- Updated package dependencies to latest versions

### Removed
- Redundant Windows username utility module

## [1.0.6] - 2025-02-06

### Added

- Window focus-aware refresh intervals
- Mid-month payment tracking and notifications
- Stripe integration for unpaid invoice handling
- New "Show Total Requests" configuration option
- Additional logging categories for debugging
- Unpaid invoice warnings with billing portal integration

### Changed

- Improved notification sorting logic (highest thresholds first)
- Refactored usage-based pricing data structure
- Enhanced status bar tooltip formatting
- Updated payment period calculations to exclude mid-month payments
- Modified status bar text display for total requests

### Fixed

- Notification clearing logic when usage drops below thresholds
- Window focus change handling during updates
- Error handling for Stripe session URL retrieval
- Configuration change detection for total requests display

## [1.0.5-beta.15] - 2025-02-6

### Added

- Configurable refresh interval setting (minimum 5 seconds)
- SQL.js database support for improved cross-platform compatibility
- New database error handling and logging mechanisms

### Changed

- Replaced SQLite3 with SQL.js to eliminate native dependencies
- Complete database handling refactor for better reliability
- Updated package dependencies and lockfile
- Improved installation process by removing postinstall script

### Removed

- SQLite3 native dependency and related build scripts
- Database connection pooling and monitoring logic
- Unused dependencies and development files

### Fixed

- Potential installation issues on ARM architectures
- Database file path resolution logic
- Memory leaks in database handling
- Error handling during token retrieval

## [1.0.5-beta.3] - 2024-02-14

### Added

- Support for new startOfMonth field in API response
- Smart notification system with configurable thresholds
- Optional status bar colors with configuration
- Support for Cursor nightly version database paths
- Enhanced tooltip with compact and modern layout
- Improved settings accessibility features

### Changed

- Improved handling of usage-based pricing billing cycle (3rd/4th day)
- Enhanced error handling and API response processing
- Better startup behavior for notifications and status bar
- Refined settings navigation and accessibility
- Updated tooltip design with better organization

### Fixed

- Startup notification and status bar visibility issues
- Double notifications on startup
- Settings button functionality when no file is open
- Status bar visibility during notifications

### Known Issues

- macOS support is currently not available (still working on it)

## [1.0.4] - 2025-02-02

### Added

- WSL (Windows Subsystem for Linux) support for database path
- Dynamic status bar colors based on usage percentage
- Interactive buttons in tooltip for quick actions:
  - Refresh Statistics
  - Open Settings
  - Usage Based Pricing Settings
- Debug logging system with configuration option
- Improved tooltip formatting and alignment
  - Combined Period and Last Updated into a single line
  - Left-aligned Period and right-aligned Last Updated
  - Moved Total Cost to Current Usage line
  - Centered section titles
  - Added action buttons section
- Dynamic status bar improvements:
  - Usage-based color theming
  - Visual status indicators
  - Custom color scheme support

### Changed

- Enhanced error handling for database connections
- Improved WSL detection and path resolution
- Better visual organization of usage information
- Refined status bar color transitions based on usage levels
- Added detailed logging for debugging purposes
- Improved command handling and user interaction

## [1.0.2] - 2025-02-02

### Added

- Click-to-settings functionality in status bar
- Automatic token retrieval from local database

### Changed

- Enhanced tooltip UI with better formatting and icons
- Improved separator styling for better readability
- Updated status bar icons for better visual consistency

## [1.0.1] - 2025-02-02

### Added

- Extension icon for better visibility in VS Code Marketplace
- Improved tooltip formatting for status bar items
- Better alignment of list items in the display

## [1.0.0] - 2025-02-02

### Added

- Initial release
- Status bar integration showing Cursor usage statistics
- Session token management
- Real-time statistics updates
