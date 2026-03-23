# 📦 Installation and Deployment Guide

Follow these steps to set up your own instance of **Crunchyroll Downloader** using Docker.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your server:
- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

---

## 🛠️ Deployment with Docker Compose (Recommended)

### 1. Clone the repository
```bash
git clone https://github.com/your-user/Crunchyroll-Donwloader-Docker.git
cd Crunchyroll-Donwloader-Docker
```

### 2. Configure Environment Variables (.env)
The system uses a `.env` file in the root (inside `/backend` or the root depending on your volume structure) for critical configuration. Create the file and define the parameters:

```bash
# SECURITY
ADMIN_PASSWORD=my_super_password    # Initial password for the 'admin' user
JWT_SECRET=a_unique_secret           # Key for signing sessions (Change this!)

# SERVER
PORT=3001                            # Internal backend port
DB_PATH=./data/database.sqlite       # Local database path

# STORAGE
DOWNLOAD_DIR=./downloads             # Main anime download folder path
LIBRARY_PATHS=./downloads,./media    # Additional paths for library scanning

# EXTERNAL APIS (OPTIONAL)
TMDB_API_KEY=your_api_key_here       # TMDB Key for metadata enrichment
```

### 3. Configure Volumes
Open the `docker-compose.yml` file and verify the mount paths, ensuring they match your server's physical paths:

```yaml
volumes:
  - ./backend/data:/app/data           # Database
  - ./downloads:/app/downloads         # Your Anime library
  - /your/external/drive:/app/media    # Additional volumes (optional)
```

### 4. Start Services
Run the following command to build and start the containers in the background:

```bash
docker compose up -d --build
```

---

## ⚙️ Initial Setup

Once the containers are running, the application will be available at:
- **Frontend**: `http://localhost:5173` (or the configured port)
- **Backend API**: `http://localhost:3000`

### First Steps:
1.  **Create Administrator**: After the first start, the system creates a default `admin` user (verify logs if necessary or create one via the API).
2.  **Configure Catalog**: Go to the **Full Catalog** panel to start suggesting initial content.
3.  **Disk Management**: Go to **System Admin** and verify that the mounted volumes are correctly detected by the telemetry system.

---

## 💾 Adding Additional Storage (Hard Drives)

If you have multiple drives or want to separate your downloads by category, follow these steps:

1. **Mount in Docker**: Add a new volume in your `docker-compose.yml` pointing to your physical drive.
   ```yaml
   volumes:
     - /mnt/anime_drive_2:/app/media_extra  # Mounting the new drive
   ```

2. **Register in the System**: Edit your `.env` file so the scanner knows where to look:
   ```bash
   LIBRARY_PATHS=/app/downloads,/app/media_extra
   ```

3. **Verification**: Restart the containers (`docker compose up -d`). The telemetry system in the **Admin Panel** will automatically detect the new mount point and show its capacity and usage in GB.

> [!WARNING]
> **Windows Users (Docker Desktop)**:
> If you are on Windows, you must explicitly enable access to the drive or folder in the Docker Desktop settings:
> **Settings -> Resources -> File Sharing**. Add the drive letter (e.g., `D:`) or the folder path if it's not in the default list. Without this, the container will see the mounted folder, but it will always be empty.

---

## 🐳 Docker CLI (Manual Use)

If you prefer not to use Compose, you can build the image manually:

```bash
docker build -t crunchy-downloader .
docker run -p 3000:3000 -v $(pwd)/data:/app/data crunchy-downloader
```

---

## 🔧 Troubleshooting

- **Disk Permissions**: Ensure the Docker user has write permissions for the `./downloads` folders.
- **FFmpeg**: The container already includes the necessary dependencies. If you experience conversion failures, ensure the host has enough memory assigned to Docker.
- **Remote Access**: If deploying on a remote server, ensure you open the necessary ports in your firewall.

---

> [!IMPORTANT]
> It is strongly recommended to use a dedicated drive for anime downloads, as the library can grow very quickly.
