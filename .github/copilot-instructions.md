# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
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
                        
                        // Verify essential states were created
                        const essential_states = [
                            'your-adapter.0.info.connection',
                            'your-adapter.0.your-main-state'
                        ];

                        for (const state_id of essential_states) {
                            const state = await harness.states.getStateAsync(state_id);
                            if (!state) {
                                return reject(new Error(`Essential state not found: ${state_id}`));
                            }
                            console.log(`✅ Found state: ${state_id} = ${state.val}`);
                        }

                        console.log('✅ All integration tests passed!');
                        resolve(true);

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

## Error Handling Patterns

### General Adapter Error Handling
```javascript
try {
  // Risky operation
  await someAsyncOperation();
} catch (error) {
  this.log.error(`Operation failed: ${error.message}`);
  this.setState('info.connection', false, true);
  // Don't throw - handle gracefully
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

### State Management

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

## Adapter Lifecycle Management

### Initialization Pattern
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

### Proper Cleanup
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

## JSON-Config Management

### Modern Configuration UI
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

### Configuration Validation
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