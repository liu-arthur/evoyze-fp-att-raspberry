const cron = require('node-cron'); // Library for scheduling tasks
const http = require('http'); // Built-in HTTP module
const fs = require('fs'); // File system module
const path = require('path'); // Module for handling paths
const logMessage = require('./tools/logger'); // Import the logging function from the new location

// Define lock file path
const lockFilePath = path.join(process.cwd(), 'lockfile.lock');

// Function to check if the application is already running
const isRunning = () => {
  return fs.existsSync(lockFilePath);
};

// Create a lock file to prevent multiple instances
const createLockFile = () => {
  fs.writeFileSync(lockFilePath, 'lock'); // Create a lock file
};

// Remove the lock file when exiting
const removeLockFile = () => {
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
  }
};

// Load configuration using current working directory (CWD)
const configPath = path.join(process.cwd(), 'config', 'my-config.json'); // Keep this path unchanged
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); // Read and parse the configuration file

// Destructure the config values
const { apiUrl, jsonFilePath, schedule } = config;

// Ensure apiUrl ends with "/"
const apiBase = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;

/**
 * Sends the contents of a JSON file to a specified API endpoint.
 * If the API response is "ok", the JSON file is deleted.
 */
const sendJsonToApi = async () => {
  const apiEndpoint = `${apiBase}dev`;

  try {
    const jsonData = fs.readFileSync(jsonFilePath);

    const options = {
      hostname: new URL(apiEndpoint).hostname,
      path: new URL(apiEndpoint).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (responseData === "ok") {
          logMessage('Data sent successfully, deleting the JSON file...');
          fs.unlinkSync(jsonFilePath); // Delete the file
          logMessage('JSON file deleted successfully.');
        } else {
          logMessage('Response was not "ok": ' + responseData);
        }
      });
    });

    req.on('error', (error) => {
      logMessage('Error sending data: ' + error.message);
    });

    req.write(jsonData);
    req.end();

  } catch (error) {
    logMessage('Error reading JSON file: ' + error.message);
  }
};

/**
 * Notifies the server that this device is online.
 * Sends a GET request to the specified onlineApiUrl.
 */
const notifyServerOnline = async () => {
  const apiEndpoint = `${apiBase}online`;

  const options = {
    hostname: new URL(apiEndpoint).hostname,
    path: new URL(apiEndpoint).pathname,
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      logMessage('Server notified of online status: ' + responseData);
    });
  });

  req.on('error', (error) => {
    logMessage('Error notifying server online: ' + error.message);
  });

  req.end();
};

// Check for existing lock file to see if the application is already running
if (isRunning()) {
  logMessage('Application is already running. Exiting...');
  process.exit(0); // Exit if already running
}

// Create a lock file to prevent multiple instances
createLockFile();

// Check for command-line arguments
const args = process.argv.slice(2);
if (args.includes('run')) {
  logMessage('Immediate execution triggered by command-line argument.');
  sendJsonToApi().then(() => {
    logMessage('Completed immediate execution.'); // Log after execution
  });
}

// Schedule the task to send JSON data based on the configured schedule
cron.schedule(schedule, () => {
  logMessage('Running scheduled task to send JSON data...');
  sendJsonToApi(); // Call the function to send JSON data
});

// Schedule the task to notify the server of online status every 15 minutes
cron.schedule('*/15 * * * *', () => {
  logMessage('Running scheduled task to notify server online...');
  notifyServerOnline(); // Call the function to notify the server
});

// Notify the server of the device's online status when the script starts
notifyServerOnline();

logMessage('Scheduler is running...'); // Log that the scheduler has started

// Remove the lock file when the process exits
process.on('exit', removeLockFile);
process.on('SIGINT', () => {
  removeLockFile();
  process.exit();
});
