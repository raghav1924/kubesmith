# Deployment & Production Operations — KubeSmith

**Target:** Kubernetes Manifest Linter, Pod Security Standards & Topology Studio  
**Author:** Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))

---

## 1. Container Deployment (Docker)

```bash
docker build -t kubesmith:latest .
docker run -d -p 5454:5454 --name kubesmith kubesmith:latest
```

## 2. Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/bin.js --name "kubesmith" -- studio --port 5454
```

## 3. Systemd Service Unit

```ini
[Unit]
Description=KubeSmith Background Service
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/kubesmith
ExecStart=/usr/bin/node dist/bin.js studio --port 5454
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
