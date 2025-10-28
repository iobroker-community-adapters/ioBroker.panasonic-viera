# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.2
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context: Panasonic Viera Smart-TV Integration

This is the **panasonic-viera** adapter for controlling Panasonic Viera Smart-TV devices via ioBroker. Key characteristics:

- **Primary Function**: Remote control and status monitoring of Panasonic Viera Smart-TV devices
- **Core Technology**: Uses `node-panasonic-viera` library for TV communication
- **Communication Method**: Network-based HTTP/HTTPS commands to TV APIs
- **Key Features**: 
  - TV power control and status monitoring
  - Channel management and navigation
  - Input source switching (HDMI, etc.)
  - Volume and mute controls
  - Remote key simulation (arrow keys, enter, back, etc.)
  - Application launching and smart features access

### TV-Specific Development Considerations

- **Network Discovery**: TVs may be discovered via SSDP or configured manually with IP addresses
- **Authentication**: Modern Viera models require Application ID and Encryption Key for secure communication
- **State Management**: TV states include power status, current channel, volume, input source
- **Error Handling**: Network timeouts, TV unavailability, and authentication failures are common scenarios
- **Key Mapping**: Extensive mapping between ioBroker states and Viera remote control keys
- **Ping Monitoring**: Uses ping to verify TV network availability before sending commands

### Development Patterns for Smart-TV Adapters

When working on this adapter, consider:

- Always check TV availability before sending commands
- Implement proper timeout handling for network requests
- Handle authentication gracefully (store credentials securely)
- Map remote control keys consistently between states and API calls
- Provide clear error messages for connection and authentication issues
- Test with both older and newer TV models when possible
- Implement proper resource cleanup when adapter stops

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Get all states created by adapter
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
                        
                        console.log(`📊 Found ${stateIds.length} states`);

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            
                            // Show sample of created states
                            const allStates = await new Promise((res, rej) => {
                                harness.states.getStates(stateIds, (err, states) => {
                                    if (err) return rej(err);
                                    res(states);
                                });
                            });
                            
                            console.log('Sample of created states:', 
                                Object.keys(allStates).slice(0, 5).map(key => ({
                                    id: key,
                                    value: allStates[key].val
                                }))
                            );
                            
                            resolve(true);
                        } else {
                            reject(new Error('No states were created by the adapter'));
                        }

                    } catch (error) {
                        console.error('❌ Integration test failed:', error);
                        reject(error);
                    }
                });
            }).timeout(30000);
        });
    }
});
```

### Testing Patterns for Smart-TV Adapters

For TV adapters specifically, focus on:

```javascript
describe('Panasonic Viera Adapter Tests', () => {
    test('should handle TV unavailable scenario', async () => {
        // Mock ping to return false
        // Verify adapter sets connection state to false
        // Verify no commands are sent to unavailable TV
    });
    
    test('should map remote keys correctly', () => {
        // Test state-to-VieraKeys mapping
        // Verify all expected keys are mapped
    });
    
    test('should handle authentication properly', async () => {
        // Test with valid/invalid app ID and encryption key
        // Verify proper error handling for auth failures
    });
});
```

## README Updates

### Required Sections
When updating README.md files, ensure these sections are present and well-documented:

1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history and changes (use "## **WORK IN PROGRESS**" section for ongoing changes following AlCalzone release-script standard)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, and community support

### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (at minimum English and German)
- When creating PRs, add entries to README under "## **WORK IN PROGRESS**" section following ioBroker release script standard
- Always reference related issues in commits and PR descriptions (e.g., "solves #xx" or "fixes #xx")

### Mandatory README Updates for PRs
For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section before committing
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical implementation details
- Example: `* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing"`

### Documentation Workflow Standards
- **Mandatory README updates**: Establish requirement to update README.md for every PR/feature
- **Standardized documentation**: Create consistent format and categories for changelog entries
- **Enhanced development workflow**: Integrate documentation requirements into standard development process

### Changelog Management with AlCalzone Release-Script
Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard for changelog management:

#### Format Requirements
- Always use `## **WORK IN PROGRESS**` as the placeholder for new changes
- Add all PR/commit changes under this section until ready for release
- Never modify version numbers manually - only when merging to main branch
- Maintain this format in README.md or CHANGELOG.md:

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

-   Did some changes
-   Did some more changes

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development**: All changes go under `## **WORK IN PROGRESS**`
- **For Every PR**: Add user-facing changes to the WORK IN PROGRESS section
- **Before Merge**: Version number and date are only added when merging to main
- **Release Process**: The release-script automatically converts the placeholder to the actual version

#### Change Entry Format
Use this consistent format for changelog entries:
- `- (author) **TYPE**: User-friendly description of the change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements)
- Focus on user impact, not technical implementation details
- Reference related issues: "fixes #XX" or "solves #XX"

#### Example Entry
```markdown
## **WORK IN PROGRESS**

- (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing" (fixes #25)
- (DutchmanNL) **NEW**: Added support for device discovery to simplify initial setup
```

## Dependency Updates

### Package Management
- Always use `npm` for dependency management in ioBroker adapters
- When working on new features in a repository with an existing package-lock.json file, use `npm ci` to install dependencies. Use `npm install` only when adding or updating dependencies.
- Keep dependencies minimal and focused
- Only update dependencies to latest stable versions when necessary or in separate Pull Requests. Avoid updating dependencies when adding features that don't require these updates.
- When you modify `package.json`:
  1. Run `npm install` to update and sync `package-lock.json`.
  2. If `package-lock.json` was updated, commit both `package.json` and `package-lock.json`.

### Dependency Best Practices
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document any specific version requirements

## JSON-Config Admin Instructions

### Configuration Schema
When creating admin configuration interfaces:

- Use JSON-Config format for modern ioBroker admin interfaces
- Provide clear labels and help text for all configuration options
- Include input validation and error messages
- Group related settings logically
- Example structure:
  ```json
  {
    "type": "panel",
    "items": {
      "host": {
        "type": "text",
        "label": "Host address",
        "help": "IP address or hostname of the device"
      }
    }
  }
  ```

### Admin Interface Guidelines
- Use consistent naming conventions
- Provide sensible default values
- Include validation for required fields
- Add tooltips for complex configuration options
- Ensure translations are available for all supported languages (minimum English and German)
- Write end-user friendly labels and descriptions, avoiding technical jargon where possible

### TV-Specific Configuration Example
For ioBroker adapters, implement JSON-Config for modern admin interface:

```json
{
  "type": "panel",
  "items": {
    "ip": {
      "type": "ip",
      "label": "TV IP Address",
      "sm": 12,
      "md": 6,
      "lg": 4
    },
    "appId": {
      "type": "text",
      "label": "Application ID",
      "help": "Get from TV's network settings",
      "sm": 12,
      "md": 6,
      "lg": 4
    },
    "encryptionKey": {
      "type": "password",
      "label": "Encryption Key",
      "help": "Pairing key from TV",
      "sm": 12,
      "md": 6,
      "lg": 4
    }
  }
}
```

## Best Practices for Dependencies

### HTTP Client Libraries
- **Preferred:** Use native `fetch` API (Node.js 20+ required for adapters; built-in since Node.js 18)
- **Avoid:** `axios` unless specific features are required (reduces bundle size)

### Example with fetch:
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

### Other Dependency Recommendations
- **Logging:** Use adapter built-in logging (`this.log.*`)
- **Scheduling:** Use adapter built-in timers and intervals
- **File operations:** Use Node.js `fs/promises` for async file operations
- **Configuration:** Use adapter config system rather than external config libraries

## Error Handling

### Adapter Error Patterns
- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages that help users understand what went wrong
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and other resources in the `unload()` method

### Example Error Handling:
```javascript
try {
  await this.connectToDevice();
} catch (error) {
  this.log.error(`Failed to connect to device: ${error.message}`);
  this.setState('info.connection', false, true);
  // Implement retry logic if needed
}
```

### Network Error Handling for TV Adapters
```javascript
async sendCommand(command) {
  if (!this.tvAvailable) {
    this.log.warn('TV not available, skipping command');
    return;
  }
  
  try {
    await this.viera.sendCommand(command);
    this.setState('info.connection', true, true);
  } catch (error) {
    this.log.error(`Command failed: ${error.message}`);
    this.setState('info.connection', false, true);
    
    if (error.code === 'ECONNREFUSED') {
      this.log.info('TV appears to be off or unreachable');
    } else if (error.status === 401) {
      this.log.error('Authentication failed - check app ID and encryption key');
    }
  }
}
```

### Timer and Resource Cleanup:
```javascript
// In your adapter class
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => {
    this.checkConnection();
  }, 30000);
}

onUnload(callback) {
  try {
    // Clean up timers and intervals
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

### State Management for TV Adapters

#### State Creation Patterns
```javascript
// Create TV-specific states
await this.setObjectNotExistsAsync('power', {
  type: 'state',
  common: {
    name: 'Power',
    type: 'boolean',
    role: 'switch.power',
    read: true,
    write: true
  }
});

await this.setObjectNotExistsAsync('volume', {
  type: 'state',
  common: {
    name: 'Volume',
    type: 'number',
    role: 'level.volume',
    min: 0,
    max: 100,
    read: true,
    write: true
  }
});
```

#### State Subscription and Response
```javascript
onStateChange(id, state) {
  if (state && !state.ack) {
    const stateName = id.split('.').pop();
    
    // Handle TV-specific commands
    switch (stateName) {
      case 'power':
        this.handlePowerCommand(state.val);
        break;
      case 'volume':
        this.handleVolumeCommand(state.val);
        break;
      default:
        if (this.stateKeyMap[stateName]) {
          this.sendRemoteKey(this.stateKeyMap[stateName]);
        }
    }
  }
}
```

### Configuration Validation for TV Adapters
```javascript
// In main adapter class
validateConfig() {
  if (!this.config.ip) {
    this.log.error('IP address is required');
    return false;
  }
  
  if (!this.config.appId || !this.config.encryptionKey) {
    this.log.warn('Application ID and Encryption Key recommended for modern TVs');
  }
  
  return true;
}
```

## Adapter Lifecycle Management

### Initialization Pattern for TV Adapters
```javascript
async onReady() {
  // Validate configuration
  if (!this.config.ip) {
    this.log.error('TV IP address not configured');
    return;
  }
  
  // Initialize TV connection
  this.viera = new Viera(this.config.ip, {
    appId: this.config.appId,
    encryptionKey: this.config.encryptionKey
  });
  
  // Start monitoring
  this.startMonitoring();
  
  // Subscribe to state changes
  this.subscribeStates('*');
}

startMonitoring() {
  this.monitoringInterval = setInterval(async () => {
    const isAvailable = await this.checkTvAvailability();
    this.setState('info.connection', isAvailable, true);
  }, 30000); // Check every 30 seconds
}
```

### Proper Cleanup for TV Adapters
```javascript
onUnload(callback) {
  try {
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // Clear timeouts
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Development Best Practices

### Logging Levels
- `error`: Critical failures, configuration errors
- `warn`: Non-critical issues, fallback scenarios
- `info`: Important status changes, connections
- `debug`: Detailed operation info, useful for troubleshooting

### Resource Management
- Always clean up timers, intervals, and connections in `onUnload()`
- Use proper error boundaries to prevent adapter crashes
- Implement reconnection logic for network-dependent adapters
- Handle graceful degradation when external services are unavailable

### Performance Considerations
- Avoid frequent polling; use reasonable intervals
- Cache frequently-used data appropriately
- Implement connection pooling for HTTP-based adapters
- Monitor memory usage in long-running operations
