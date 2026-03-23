# 🚀 Crunchyroll Downloader (Docker Edition)

[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

A **premium** and **community-driven** platform for automated anime management and downloading, designed with a modern architecture and a user-centric focus.

![Dashboard Preview](docs/dashboard.png)

---

## ✨ Flagship Features

### 📺 Smart Automation (Smart DL)
- **Subscriptions with Catch-up**: Periodic series monitoring. If you subscribe late, the system automatically detects and downloads all previous missing episodes into your library.
- **Simulcast Detection**: Automatic identification of airing series for priority downloading as soon as the official episode is released.
- **FFmpeg & Undici Engine**: High-performance tech stack for ultra-fast transfers and MKV/MP4 packaging with metadata.

### 👥 Community & Moderation (RBAC)
- **Granular Roles**: Comprehensive permission management for **Administrators**, **Contributors**, and **Standard Users**.
- **Suggestion System**: Integrated global catalog where users can propose anime. Agile moderation with one-click approve/reject.
- **Transparent Auditing**: Atomic action logging (`Audit Logs`) to ensure full traceability in community management.

### 📊 High-Fidelity Dashboard & Analytics
- **Hybrid Monitoring**: Visualize both globally added series and a granular real-time feed of the latest episode downloads.
- **System Telemetry**: Live charts and metrics on storage capacity and data volume health.
- **Global Navigation**: Dynamic content discovery across the entire integrated Crunchyroll database.

### 🎨 Premium Visual Identity & UX
- **Avatar Live Sync**: Automatic identity persistence. Any change to your avatar is instantly synced with the server without manual saving.
- **Crop Editor**: Personalize your profile picture with interactive zoom and framing tools.
- **Responsive Dark Design**: Minimalist interface optimized for all devices with micro-interaction animations.

### 🛠️ High Availability Infrastructure
- **Resilient Persistence**: Optimized SQLite database with **WAL** mode and **Singleton** pattern to eliminate concurrent locks (`SQLITE_BUSY`).
- **Dockerized Architecture**: Atomic deployment, independent of the host operating system.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Vanilla CSS, Lucide Icons, React Easy Crop |
| **Backend** | Node.js, Express, Multer (Media Handling), Bcrypt (Security) |
| **Database** | SQLite (Lightweight and fast persistence) |
| **Infrastructure** | Docker & Docker Compose |

---

## 📂 Project Structure

- `/backend`: Express server, REST API, database management, and download services.
- `/frontend`: SPA application with React, component-based design system, and state management.
- `docker-compose.yml`: Full service orchestration.

---

## 📜 License

This project is licensed under the **PolyForm Noncommercial 1.0.0**.

- **Permitted**: Personal use, research, experimentation, and hobby projects without commercial application.
- **Restricted**: Any commercial use is strictly prohibited under these terms.

See the [LICENSE](LICENSE) file for the full license text.

> **Note**: This project requires a valid account for access to certain content depending on the region and the terms of service of the source platform.
