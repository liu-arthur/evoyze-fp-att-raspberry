const winston = require("winston"); // Import the winston library for logging
const path = require("path"); // Import the path module to handle file paths
const fs = require("fs"); // Import the file system module

// Define the log directory path
const logDir = path.join(process.cwd(), "log");

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir); // Create the directory synchronously
}

// Create a transport for daily rotating logs
const transport = new (require("winston-daily-rotate-file"))({
	filename: path.join(logDir, "log"), // Log file naming format
	datePattern: "DDMMYYYY", // Date format for the log files
	zippedArchive: true, // Compress old log files
	frequency: "24h", // Rotate logs every 24 hours
	maxSize: "20m", // Maximum size of a log file before rotating
	maxFiles: "7d", // Keep logs for 7 days
	level: "info", // Set the logging level
});

// Custom format to log messages
const customFormat = winston.format.printf(({ level, message, timestamp }) => {
	const date = new Date(timestamp);
	const formattedDate = `${String(date.getDate()).padStart(2, "0")}-${String(
		date.getMonth() + 1
	).padStart(2, "0")}-${date.getFullYear()} ${String(
		date.getHours()
	).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
		date.getSeconds()
	).padStart(2, "0")}`;

	return `${formattedDate} : ${message}`; // Custom output format
});

// Create the logger with the transport and custom format defined above
const logger = winston.createLogger({
	transports: [transport], // Use the transport for logging
	format: winston.format.combine(
		winston.format.timestamp(), // Add timestamp to log messages
		customFormat // Use custom format for log output
	),
});

// Function to log a message at the 'info' level
const logMessage = (message) => {
	logger.info(message); // Log the message
};

module.exports = logMessage; // Export the logMessage function for use in other modules
