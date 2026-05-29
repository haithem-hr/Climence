# TLS Certificates (demo)

This folder is used by docker-compose to mount TLS certificates for the nginx reverse proxy.

For local demo you can generate a self-signed cert:

```bash
mkdir -p infra/certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout infra/certs/climence.key \
  -out infra/certs/climence.crt \
  -days 365 \
  -subj "/CN=localhost"
```

Then start the stack and open:
- https://localhost

Browsers will show a warning for self-signed certs; accept to proceed.
