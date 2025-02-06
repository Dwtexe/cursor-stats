const { execSync } = require('child_process');
const os = require('os');

console.log('Running postinstall script...');

// Check if running on macOS
if (process.platform === 'darwin') {
    // Check if running on ARM64 (Apple Silicon)
    if (process.arch === 'arm64') {
        console.log('Detected Apple Silicon (ARM64) architecture');
        try {
            // First ensure we have the necessary build tools
            console.log('Checking/installing build dependencies...');
            try {
                execSync('which node-gyp', { stdio: 'ignore' });
            } catch {
                console.log('Installing node-gyp...');
                execSync('npm install -g node-gyp', { stdio: 'inherit' });
            }

            console.log('Rebuilding sqlite3 for ARM64...');
            execSync('npm rebuild sqlite3 --build-from-source --target_arch=arm64 --verbose', {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    CFLAGS: '-arch arm64',
                    CXXFLAGS: '-arch arm64',
                    LDFLAGS: '-arch arm64'
                }
            });
            console.log('Successfully rebuilt sqlite3 for ARM64');
        } catch (error) {
            console.error('Failed to rebuild sqlite3:', error);
            console.log('Attempting alternative rebuild method...');
            try {
                execSync('npm install sqlite3 --build-from-source --target_arch=arm64', {
                    stdio: 'inherit'
                });
                console.log('Alternative rebuild successful');
            } catch (altError) {
                console.error('Alternative rebuild also failed:', altError);
                console.log('Please ensure Xcode Command Line Tools are installed:');
                console.log('xcode-select --install');
                // Don't exit with error to allow installation to continue
                // The extension will handle SQLite errors gracefully
            }
        }
    }
}

// For other platforms, no special handling needed as prebuilt binaries should work
console.log('Postinstall completed'); 