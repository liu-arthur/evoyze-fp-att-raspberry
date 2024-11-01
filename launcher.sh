#!/bin/bash
# launcher.sh
# Run application on startup

# Disable screen blanking
xset s noblank
xset s off
xset -dpms

# Start unclutter to hide the mouse cursor
unclutter -idle 0.5 -root &

# Navigate to the raspberry-pi directory
cd /home/iot/Desktop/Attendance_Rpi/raspberry-pi 

# Run the face recognition script and log output
python face_recognize1.3.py &

# Optional: Wait a few seconds to ensure the first command is up and running
sleep 5

# Navigate to the Attendance_Rpi directory
cd /home/iot/Desktop/Attendance_Rpi/ 

# Run the attendance scheduler and log output
./att-data-scheduler-linux &

# Indicate successful launch
echo "Both applications launched successfully!" >> /home/iot/Desktop/Attendance_Rpi/log.txt
