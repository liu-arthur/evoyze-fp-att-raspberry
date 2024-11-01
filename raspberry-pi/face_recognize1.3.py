import tkinter as tk
import cv2
import numpy as np
import os
import threading
import json
import time
from datetime import datetime
from insightface.app import FaceAnalysis
from datetime import datetime
from picamera2 import Picamera2

# Global Variables
camera = None
camera_lock = threading.Lock()

# Initialize InsightFace for ArcFace-based recognition
app = FaceAnalysis(providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# Show and return from a temporary message
def show_temporary_message(var, message, delay=5000):  # Delay in milliseconds

    # Change the variable to the new message
    var.set(message)
    
    # Use after to wait for the specified delay
    root.after(delay, lambda: restore_message(var))

# Return title to original message
def restore_message(var):
    var.set("FAST People Attedance - Facial Recognition")
    clock_in_btn.config(state=tk.NORMAL)
    clock_out_btn.config(state=tk.NORMAL)

# Initialize camera with retries using Picamera2
def initialize_camera_with_retries(retries=5):
    global camera
    attempt = 0
    while attempt < retries:
        try:
            if camera is None:
                camera = Picamera2()
                
                # Get the full sensor resolution
                max_width, max_height = camera.sensor_resolution
                
                # Configure the camera with desired output size and format
                video_config = camera.create_video_configuration(
                    main={"size": (480, 320), "format": "RGB888"}
                )
                
                # Set ScalerCrop to use the full sensor area
                video_config["controls"] = {
                    "ScalerCrop": (0, 0, max_width, max_height)
                }
                
                camera.configure(video_config)
                camera.start()
                time.sleep(0.1)  # Let the camera warm up
            return camera
        except IndexError as e:
            print(f"IndexError during camera initialization: {e}")
            attempt += 1
            time.sleep(1)
            if camera:
                camera.close()
                camera = None
        except RuntimeError as e:
            print(f"RuntimeError during camera initialization: {e}")
            attempt += 1
            time.sleep(1)
            if camera:
                camera.close()
                camera = None
        
    raise RuntimeError("Camera initialization failed after multiple attempts.")


# Properly close the camera after use
def close_camera():
    global camera
    if camera:
        try:
            camera.stop()
            camera.close()
            camera = None
            cv2.destroyAllWindows()
            print("Camera stopped and closed.")
        except Exception as e:
            print(f"Error closing camera: {e}")

# Function to load stored face embeddings
def load_embeddings(embeddings_dir='embeddings'):
    embeddings = {}
    if not os.path.exists(embeddings_dir):
        print(f"Embeddings directory '{embeddings_dir}' does not exist.")
        return embeddings

    for file in os.listdir(embeddings_dir):
        if file.endswith('_embedding.npy'):
            name = file.split('_embedding.npy')[0]
            embeddings_path = os.path.join(embeddings_dir, file)
            embeddings[name] = np.load(embeddings_path)
            print(f"Loaded embedding for {name}")
    return embeddings

# Compare live embedding with stored embeddings using cosine similarity
def recognize_face(live_embedding, stored_embeddings, threshold=0.6):
    recognized_name = "Unknown"
    max_similarity = -1

    live_embedding_norm = live_embedding / np.linalg.norm(live_embedding)

    for name, stored_embedding in stored_embeddings.items():
        stored_embedding_norm = stored_embedding / np.linalg.norm(stored_embedding)
        similarity = np.dot(live_embedding_norm, stored_embedding_norm)
        if similarity > max_similarity:
            max_similarity = similarity
            recognized_name = name

    if max_similarity < threshold:
        recognized_name = "Unknown"

    return recognized_name, max_similarity
    
def get_greeting():
    current_hour = datetime.now().hour
    if current_hour < 12:
        return "Good morning"
    elif current_hour < 18:
        return "Good afternoon"
    else:
        return "Good evening"

def recognize(action, name_var):
    global camera
    with camera_lock:
        try:
            camera = initialize_camera_with_retries()
            stored_embeddings = load_embeddings()

            if not stored_embeddings:
                print("No embeddings found. Exiting.")
                name_var.set("No embeddings found.")
                return

            recognized = False

            while True:
                frame = camera.capture_array()
                if frame is None:
                    print("Failed to capture image")
                    continue

                faces = app.get(frame)
                if faces:
                    for face in faces:
                        live_embedding = face.embedding
                        recognized_name, similarity = recognize_face(live_embedding, stored_embeddings)

                        x1, y1, x2, y2 = face.bbox.astype(int)
                        if recognized_name != "Unknown":
                            label = f"{recognized_name} ({similarity:.2f})"
                            color = (0, 255, 0)
                            store_attendance(recognized_name, action)
                            
                            if action == "CI":
                                greeting = get_greeting()
                                message = f"{greeting}, {recognized_name}!"
                                threading.Thread(target=show_temporary_message, args=(name_var, message)).start()
                            elif action == "CO":
                                threading.Thread(target=show_temporary_message, args=(name_var, f"Goodbye {recognized_name}")).start()

                            recognized = True
                            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                            cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                            break
                        else:
                            label = recognized_name
                            color = (0, 0, 255)
                            threading.Thread(target=show_temporary_message, args=(name_var, "No match found")).start()
                            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                            cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                    if recognized:
                        break
                else:
                    threading.Thread(target=show_temporary_message, args=(name_var, "No face detected")).start()

                cv2.imshow("Face Recognition", cv2.resize(frame, (480, 320)))

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

        except RuntimeError as e:   
            threading.Thread(target=show_temporary_message, args=(detected_name_var, "Camera initialization failed.", 5)).start()
            print(f"Camera initialization failed: {e}")
        finally:
            close_camera()

def has_clocked_today(name, action):
    log_folder = 'attendance_log'
    log_file = os.path.join(log_folder, 'attendance.json')
    today = datetime.now().strftime('%Y-%m-%d')

    if os.path.exists(log_file):
        with open(log_file, 'r') as f:
            data = json.load(f)

        for record in data:
            # Check for matching user ID, state, and date
            if ("dev_user_id" in record and 
                "state" in record and 
                "clock_on" in record):
                
                if (record["dev_user_id"] == name and 
                    record["state"] == action and 
                    record["clock_on"].startswith(today)):  # Check if the date matches
                    return True
    return False


def store_attendance(dev_user_id, state):
    log_folder = 'attendance_log'
    log_file = os.path.join(log_folder, 'attendance.json')

    if not os.path.exists(log_folder):
        os.makedirs(log_folder)

    if has_clocked_today(dev_user_id, state):
        print (f"{dev_user_id} has already {state.lower()} today.")
        return

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    attendance_data = {"dev_user_id": dev_user_id, "state": state, "clock_on": timestamp}

    if os.path.exists(log_file):
        with open(log_file, 'r') as f:
            data = json.load(f)
    else:
        data = []

    data.append(attendance_data)

    with open(log_file, 'w') as f:
        json.dump(data, f, indent=4)

    print(f"Stored: {attendance_data}")

def start_recognition(action):
    # Disable both buttons
    clock_in_btn.config(state=tk.DISABLED)
    clock_out_btn.config(state=tk.DISABLED)
    
    detected_name_var.set("Scanning...")
    threading.Thread(target=recognize, args=(action, detected_name_var)).start()

def update_datetime():
    current_datetime = datetime.now().strftime('%Y-%m-%d %H:%M')  # Format to show only hours and minutes
    datetime_label.config(text=current_datetime)  # Update the datetime label
    root.after(60000, update_datetime)  # Schedule the next update in 1 minute

# Tkinter UI Setup
root = tk.Tk()
root.title("Attendance System")
root.attributes('-fullscreen', True)

# StringVar for displaying detected names
detected_name_var = tk.StringVar()
detected_name_var.set("FAST People Attedance - Facial Recognition")

# Label to show detected name
detected_name_label = tk.Label(root, textvariable=detected_name_var, font=('Arial', 12))
detected_name_label.grid(row=0, column=0, columnspan=2, pady=5)

# Label for date and time
datetime_label = tk.Label(root, font=('Arial', 12))
datetime_label.grid(row=1, column=0, columnspan=2, pady=5)

# Fixed button size
button_width = 15
button_height = 35

# Buttons
clock_in_btn = tk.Button(root, text="Clock In\n\n 打卡\n\n Masuk", bg="green", fg="white",
                         command=lambda: start_recognition("CI"),
                         font=('Arial', 14), width=button_width, height=button_height,
                         activebackground="green", highlightbackground="green")
clock_in_btn.grid(row=2, column=0, padx=10, pady=5, sticky='ew')

clock_out_btn = tk.Button(root, text="Clock Out\n\n  打卡\n\n Keluar", bg="red", fg="white",
                          command=lambda: start_recognition("CO"),
                          font=('Arial', 14), width=button_width, height=button_height,
                          activebackground="red", highlightbackground="red")
clock_out_btn.grid(row=2, column=1, padx=10, pady=5, sticky='ew')

# Footer
footer_frame = tk.Frame(root)
footer_frame.grid(row=3, column=0, columnspan=2, sticky='ew')

# Footer Label
footer_label = tk.Label(footer_frame, text="© 2024 E Voyze Sdn Bhd", font=("Arial", 10))
footer_label.pack()

# Configure grid weights for resizing
root.grid_rowconfigure(2, weight=1)
root.grid_rowconfigure(3, weight=0)
root.grid_columnconfigure(0, weight=1)
root.grid_columnconfigure(1, weight=1)

# Start the datetime update
update_datetime()

# Start Tkinter main loop
root.mainloop()