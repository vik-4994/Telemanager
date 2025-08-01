# 📲 Telemanager

**Telemanager** is a web-based Telegram management platform that allows you to control multiple Telegram accounts, invite users, monitor account health, and send private messages — all in one place.

## 🚀 Features

- 🔐 Secure login via `.session` files  
- 🌐 Proxy support per Telegram account  
- 👥 Invite users from source channels to destination groups via intermediate channels  
- 📊 Dashboard for accounts, proxies, channels, and invite tasks  
- ✅ Telegram account health check (alive/dead)  
- ✉️ Direct messaging (DM) support  
- ⏱️ Celery-based task queue with PostgreSQL row-level locking  

## ⚙️ Tech Stack

- **Backend:** Django + FastAPI  
- **Frontend:** React + Tailwind CSS  
- **Database:** PostgreSQL  
- **Queue:** Celery + Redis  
- **Telegram API:** Telethon  
- **Deployment:** Docker, Nginx (optional)
