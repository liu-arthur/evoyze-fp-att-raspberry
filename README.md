# FAST People Attendance x Raspberry Pi Scheduler Application

This Node.js application is designed to send JSON data to a FAST People Attendance API endpoint on a scheduled basis and notify a server of this device's online status. It also allows for immediate execution of the JSON sending functionality via command-line parameters.

## Features

- **Scheduled Tasks**: Uses cron jobs to send JSON data at defined intervals.
- **Immediate Execution**: Can execute the JSON sending function immediately via a command-line parameter.
- **Lock Mechanism**: Prevents multiple instances of the application from running simultaneously.
- **Logging**: Records actions and errors to a log file for tracking.
- **Configurable**: Uses a JSON configuration file for easy setup.

## Directory Structure

```
/scheduler
├── app
│   ├── scheduler.js            # Main application script
│   └── tools
│       └── logger.js           # Logging utility
├── raspberry-pi
│   ├── face_recognize1.3.py    # GUI for user to clock-in and clock-out
│   └── attendance_log
│       └── attendance.json     # Path to the JSON file containing attendance data captured by the device
├── config
│   └── my-config.json     # Configuration file for API and settings
└── lockfile.lock          # Lock file to prevent multiple instances (auto-generated)
```

## Configuration

The application reads its configuration from `./config/my-config.json`. Here’s an example of what the configuration file might look like based on the provided JSON:

```json
{
  "apiUrl": "https://your-api-endpoint.com",                        // URL for the FAST People Attendance API
  "jsonFilePath": "./raspberry-pi/attendance_log/attendance.json",  // Path to the JSON file containing attendance data captured by the device
  "schedule": "*/15 * * * *",                                       // Cron expression for scheduling data uploads to the FAST People server
  "dev_group": "OFFICE1",                                           // Device group identifier
  "dev_passcode": "123456",                                         // Device passcode
  "dev_id": "1"                                                     // Device identifier
}
```

### Configuration Fields

- `apiUrl`: The endpoint to which JSON data will be sent.
- `jsonFilePath`: The path to the JSON file containing the data to be sent.
- `schedule`: Cron expression for scheduling the task.
- `dev_group`: Identifier for the device group.
- `dev_passcode`: Passcode for device authentication.
- `dev_id`: Unique identifier for the device.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/liu-arthur/evoyze-fp-att-raspberry.git
   cd my-scheduler
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install pkg globally** (if not already installed):
   ```bash
   npm install -g pkg
   ```

## Usage

### Running the Application

To start the application normally (scheduled execution):
```bash
node app/app.js
```

To execute the JSON sending function immediately:
```bash
node app/app.js run
```

### Building the Application

To build the application for different platforms, follow these steps:
1. Open the terminal in VS Code.
2. Run the npm script to build:
   ```bash
   npm run build
   ```
3. Once the build is complete, you will find the output in the `./build` directory.

### Packaging for Raspberry Pi

To create a standalone executable for the Raspberry Pi, follow these steps after building:

1. Copy the generated executable, `launcher.sh`, and any necessary files into the `raspberry-pi` directory on your Raspberry Pi.
2. Edit the autostart file to run `launcher.sh` on boot:
   ```bash
   sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
   ```
   Add the following line at the end of the file:
   ```bash
   @/path/to/your/raspberry-pi/launcher.sh
   ```
   (Replace `/path/to/your/raspberry-pi/` with the actual path.)

3. Ensure the script is executable:
   ```bash
   chmod +x /path/to/your/raspberry-pi/launcher.sh
   chmod +x /path/to/executable file
   ```

## Logging

Logs are generated in the specified log directory. Each log file follows the naming convention `log`, and older logs are deleted every 7 days.

## Notes

- Ensure that your Raspberry Pi has internet access for the API requests.
- The application will create a `lockfile.lock` in the working directory to prevent multiple instances. This file will be automatically removed when the application exits.
- **Important**: The device information must be registered in the FAST People Attendance Module for proper functionality.