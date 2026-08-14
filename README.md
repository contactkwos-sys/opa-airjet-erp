# OPA Air Jet Loom Management System

Operations ERP for **OPA Group of India** air jet loom fleet (72 looms) plus Security & Visitor Management.

## Modules

- Loom operations dashboard (fleet, production, maintenance, inventory, purchase)
- **Security + Visitor Management** (dashboard, visiting requests, CEO approval, WhatsApp notify, gate pass, vehicles, material gate, incidents, reports)

See [docs/SECURITY_MODULE.md](docs/SECURITY_MODULE.md) for Security setup, env vars, WhatsApp and migrations.

## Develop

```bash
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
