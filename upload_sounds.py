import os
import zipfile
from ftplib import FTP

# Configuration
FTP_HOST = 'ftp.example.com'
FTP_USER = 'your_username'
FTP_PASS = 'your_password'
REMOTE_DIR = '/path/to/remote/dir'
LOCAL_DIR = './dist/sounds'
ZIP_FILE = 'sounds.zip'

# Step 1: Zip the folder
def zip_folder(folder_path, zip_path):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, folder_path)
                zipf.write(file_path, arcname)

# Step 2: Upload the zip file to the FTP server
def upload_to_ftp(zip_path):
    with FTP(FTP_HOST) as ftp:
        ftp.login(FTP_USER, FTP_PASS)
        ftp.cwd(REMOTE_DIR)
        with open(zip_path, 'rb') as f:
            ftp.storbinary(f'STOR {ZIP_FILE}', f)

# Step 3: Unzip the file on the server (requires server-side script or SSH access)
def unzip_on_server():
    print("Unzipping on the server must be handled server-side, e.g., via SSH or a server script.")

if __name__ == '__main__':
    # Zip the folder
    print("Zipping folder...")
    zip_folder(LOCAL_DIR, ZIP_FILE)

    # Upload the zip file
    print("Uploading zip file to FTP server...")
    upload_to_ftp(ZIP_FILE)

    # Unzip on the server
    print("Unzipping on the server...")
    unzip_on_server()

    # Cleanup local zip file
    print("Cleaning up local zip file...")
    os.remove(ZIP_FILE)