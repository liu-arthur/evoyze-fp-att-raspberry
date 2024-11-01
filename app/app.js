const os = require("os"); // Module for operating system-related utility methods
const cron = require("node-cron"); // Library for scheduling tasks using cron syntax
const http = require("http"); // Built-in module for making HTTP requests
const https = require("https"); // Module for making HTTPS requests
const fs = require("fs"); // Module for file system operations (reading/writing files)
const path = require("path"); // Module for handling and manipulating file paths
const logMessage = require("./tools/logger"); // Import the logging function for outputting messages

// Define the path for the lock file to prevent multiple instances of the application
const lockFilePath = path.join(process.cwd(), "lockfile.lock");

// Function to check if the application is already running by looking for the lock file
const isRunning = () => {
	return fs.existsSync(lockFilePath); // Returns true if the lock file exists
};

// Create a lock file to prevent the application from running multiple instances simultaneously
const createLockFile = () => {
	fs.writeFileSync(lockFilePath, "lock"); // Create a lock file with a simple message
};

// Remove the lock file when the application exits to allow future runs
const removeLockFile = () => {
	if (fs.existsSync(lockFilePath)) {
		// Check if the lock file exists
		fs.unlinkSync(lockFilePath); // Delete the lock file
	}
};

// Function to get the local IP address of the device
const getLocalIP = () => {
	const interfaces = os.networkInterfaces(); // Retrieve the network interfaces
	for (const interface in interfaces) {
		for (const details of interfaces[interface]) {
			// Check for an IPv4 address that is not a loopback address (localhost)
			if (details.family === "IPv4" && !details.internal) {
				return details.address; // Return the found local IP address
			}
		}
	}
	return null; // Return null if no suitable local IP is found
};

// Load configuration using the current working directory (CWD)
const configPath = path.join(process.cwd(), "config", "my-config.json"); // Path to the config file
const config = JSON.parse(fs.readFileSync(configPath, "utf8")); // Read and parse the config file

// Destructure the config values
const {
	apiUrl,
	apiKey,
	jsonFilePath,
	schedule,
	dev_group,
	dev_passcode,
	dev_id,
} = config;

// Ensure the API URL ends with a "/" for consistent endpoint construction
const apiBase = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;

/**
 * Sends the contents of a JSON file to a specified API endpoint.
 * If the API response is "ok", the JSON file is deleted.
 */
const sendJsonToApi = async () => {
    const apiEndpoint = `${apiBase}att-log`; // Construct the API endpoint for notifying online status
    const localIP = getLocalIP(); // Get the local IP address of the device

    // Define the path to the attendance JSON file
    const attendanceFilePath = path.join(process.cwd(), jsonFilePath); // Path to attendance.json

    // Check if the attendance JSON file exists
    if (!fs.existsSync(attendanceFilePath)) {
        logMessage("Error: attendance.json file does not exist. Ending process."); // Log error message
        process.exit(1); // Exit the process with a failure code
    }

    // Load attendance data from the JSON file
    let attendanceData;
    try {
        const fileContent = fs.readFileSync(attendanceFilePath, "utf8"); // Read the file content
        attendanceData = JSON.parse(fileContent); // Parse the JSON content
    } catch (error) {
        logMessage("Error reading attendance JSON file: " + error.message); // Log error if reading fails
        process.exit(1); // Exit the process with a failure code
    }

    // Create the request body with necessary device information
    const body = JSON.stringify({
        dev_group: dev_group, // Get from config
        dev_passcode: dev_passcode, // Get from config
        dev_id: dev_id, // Get from config
        ip_addr: localIP, // Use the local IP address here
        dev_log: attendanceData, // Include attendance data in dev_log
    });

    // Set up the options for the HTTP/HTTPS request
    const url = new URL(apiEndpoint);
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
            Authorization: apiKey, // Include authorization key from config
            "Content-Type": "application/json", // Specify content type as JSON
            "Content-Length": Buffer.byteLength(body), // Set the content length based on the request body
        },
    };

    const req = (url.protocol === "https:" ? https : http).request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
            responseData += chunk; // Accumulate response data
        });

        res.on("end", () => {
            try {
                const jsonResponse = JSON.parse(responseData); // Parse the JSON response
                if (jsonResponse.msg === "ok") {
                    logMessage("Data sent successfully, deleting the JSON file...");
                    fs.unlinkSync(attendanceFilePath); // Delete the JSON file
                    logMessage("JSON file deleted successfully.");
                    logMessage("Processed: " + jsonResponse.processedCount);
                } else {
                    logMessage('Response was not "ok": ' + jsonResponse.msg);
                }
            } catch (err) {
                logMessage("Failed to parse server response: " + responseData);
            }
        });
    });

    req.on("error", (error) => {
        logMessage("Error sending data: " + error.message);
    });

    // Log and send the request body
    logMessage("Sending JSON to the server...");
    req.write(body); // Write the body to the request
    req.end(); // End the request
};


/**
 * Notifies the server that this device is online.
 * Sends a POST request with device information to the specified API endpoint.
 */
const notifyServerOnline = async () => {
    const apiEndpoint = `${apiBase}att-dev`; // Construct the API endpoint for notifying online status
    const localIP = getLocalIP(); // Get the local IP address of the device

    // Create the request body with necessary device information
    const body = JSON.stringify({
        dev_group: dev_group, // Get from config
        dev_passcode: dev_passcode, // Get from config
        dev_id: dev_id, // Get from config
        ip_addr: localIP, // Use the local IP address here
        dev_log: [], // Remain as an empty array
    });

    // Set up the options for the HTTP/HTTPS request
    const url = new URL(apiEndpoint);
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
            Authorization: apiKey, // Include authorization key from config
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
        },
    };

    // Use the appropriate request module based on the API endpoint's protocol
    const req = (url.protocol === "https:" ? https : http).request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
            responseData += chunk; // Append incoming data chunks to responseData
        });

        res.on("end", () => {
            try {
                const jsonResponse = JSON.parse(responseData);
                console.log("Server notified of online status: ", jsonResponse.msg);
            } catch (err) {
                console.error("Failed to parse response: ", responseData);
            }
        });
    });

    req.on("error", (error) => {
        console.error("Error notifying server online: " + error.message);
    });

    // Log and send the request body
    console.log("Sending notification to server...");
    req.write(body); // Write the body to the request
    req.end(); // End the request
};

// Check for existing lock file to see if the application is already running
if (isRunning()) {
	logMessage("Application is already running. Exiting..."); // Log message indicating duplicate run
	process.exit(0); // Exit the application if already running
}

// Create a lock file to prevent multiple instances
createLockFile();

// Check for command-line arguments to trigger immediate execution
const args = process.argv.slice(2); // Get command-line arguments
if (args.includes("run")) {
	logMessage("Immediate execution triggered by command-line argument."); // Log immediate execution trigger
	sendJsonToApi().then(() => {
		logMessage("Completed immediate execution."); // Log completion of immediate execution
	});
}

// Schedule the task to send JSON data based on the configured schedule
cron.schedule(schedule, () => {
	logMessage("Running scheduled task to send JSON data..."); // Log the scheduled task
	sendJsonToApi(); // Call the function to send JSON data
});

// Schedule the task to notify the server of online status every 15 minutes
cron.schedule("*/15 * * * *", () => {
	logMessage("Running scheduled task to notify server online..."); // Log the scheduled task
	notifyServerOnline(); // Call the function to notify the server
});

// Notify the server of the device's online status when the script starts
notifyServerOnline();

logMessage("Scheduler is running..."); // Log that the scheduler has started

// Remove the lock file when the process exits
process.on("exit", removeLockFile); // Remove lock file on exit
process.on("SIGINT", () => {
	removeLockFile(); // Remove lock file on interrupt signal (Ctrl+C)
	process.exit(); // Exit the process
});
