# Zeabur API Client

A Python CLI tool for managing Zeabur services via their GraphQL API.

## Features

- List projects and services
- Restart/Stop/Start services
- Redeploy services
- Execute commands on services
- View runtime logs

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

1. Get your API token from [Zeabur Developer Settings](https://dash.zeabur.com/account/developer)

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Add your token to `.env`:
```
ZEABUR_API_TOKEN=your_api_token_here
```

## Usage

### View User Info
```bash
python cli.py me
```

### List Projects
```bash
python cli.py projects
```

### Show Project Details
```bash
python cli.py project <project_id>
```

### Service Management

```bash
# Restart service
python cli.py restart <service_id> <environment_id>

# Stop service
python cli.py stop <service_id> <environment_id>

# Start service
python cli.py start <service_id> <environment_id>

# Redeploy service
python cli.py redeploy <service_id> <environment_id>
```

### Execute Commands
```bash
python cli.py exec <service_id> <environment_id> ls -la
```

### View Logs
```bash
python cli.py logs <project_id> <service_id> <environment_id> --limit 100
```

## Finding IDs

1. Run `python cli.py projects` to get project IDs
2. Run `python cli.py project <project_id>` to get service and environment IDs

## API Reference

You can also use `ZeaburClient` directly in Python:

```python
from zeabur_client import ZeaburClient

client = ZeaburClient("your_api_token")

# List projects
projects = client.list_projects()

# Restart a service
client.restart_service(service_id, environment_id)
```
