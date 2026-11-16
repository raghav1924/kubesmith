# Liveness, Readiness Probes & Graceful Shutdown

Handling rolling updates without dropped connections:
- `readinessProbe`: Prevents traffic from reaching containers before database connections are established.
- `livenessProbe`: Restarts deadlocked containers.
- `preStop` hook & `terminationGracePeriodSeconds`: Flushes in-flight HTTP requests before SIGKILL.
