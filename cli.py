#!/usr/bin/env python3
"""
Zeabur CLI - Command line interface for Zeabur API
"""

import os
import json
import click
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from zeabur_client import ZeaburClient

load_dotenv()
console = Console()


def get_client() -> ZeaburClient:
    """Get configured Zeabur client"""
    token = os.getenv("ZEABUR_API_TOKEN")
    if not token:
        console.print("[red]Error: ZEABUR_API_TOKEN not set[/red]")
        console.print("Set it in .env file or as environment variable")
        raise SystemExit(1)
    return ZeaburClient(token)


@click.group()
def cli():
    """Zeabur API CLI - Manage your Zeabur services"""
    pass


# === User Commands ===

@cli.command()
def me():
    """Show current user info"""
    client = get_client()
    result = client.get_current_user()
    user = result.get("me", {})

    console.print(Panel(
        f"Username: {user.get('username', 'N/A')}\n"
        f"Email: {user.get('email', 'N/A')}\n"
        f"Name: {user.get('name', 'N/A')}\n"
        f"ID: {user.get('_id', 'N/A')}",
        title="Current User"
    ))


# === Project Commands ===

@cli.command()
def projects():
    """List all projects"""
    client = get_client()
    result = client.list_projects()
    projects_list = result.get("projects", [])

    if not projects_list:
        console.print("[yellow]No projects found[/yellow]")
        return

    table = Table(title="Projects")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Description")

    for project in projects_list:
        table.add_row(
            project.get("_id", ""),
            project.get("name", ""),
            project.get("description", "") or "-"
        )

    console.print(table)


@cli.command()
@click.argument("project_id")
def project(project_id):
    """Show project details"""
    client = get_client()
    result = client.get_project(project_id)
    proj = result.get("project", {})

    console.print(Panel(
        f"Name: {proj.get('name', 'N/A')}\n"
        f"ID: {proj.get('_id', 'N/A')}\n"
        f"Description: {proj.get('description', 'N/A') or '-'}",
        title="Project Details"
    ))

    # Services
    services = proj.get("services", [])
    if services:
        table = Table(title="Services")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Template")

        for svc in services:
            table.add_row(
                svc.get("_id", ""),
                svc.get("name", ""),
                svc.get("template", "") or "-"
            )
        console.print(table)

    # Environments
    envs = proj.get("environments", [])
    if envs:
        table = Table(title="Environments")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")

        for env in envs:
            table.add_row(env.get("_id", ""), env.get("name", ""))
        console.print(table)


# === Service Commands ===

@cli.command()
@click.argument("service_id")
@click.argument("environment_id")
def restart(service_id, environment_id):
    """Restart a service"""
    client = get_client()
    try:
        client.restart_service(service_id, environment_id)
        console.print(f"[green]✓ Service {service_id} restarted successfully[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to restart service: {e}[/red]")


@cli.command()
@click.argument("service_id")
@click.argument("environment_id")
def stop(service_id, environment_id):
    """Stop (suspend) a service"""
    client = get_client()
    try:
        client.suspend_service(service_id, environment_id)
        console.print(f"[green]✓ Service {service_id} stopped successfully[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to stop service: {e}[/red]")


@cli.command()
@click.argument("service_id")
@click.argument("environment_id")
def start(service_id, environment_id):
    """Start (resume) a suspended service"""
    client = get_client()
    try:
        client.resume_service(service_id, environment_id)
        console.print(f"[green]✓ Service {service_id} started successfully[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to start service: {e}[/red]")


@cli.command()
@click.argument("service_id")
@click.argument("environment_id")
def redeploy(service_id, environment_id):
    """Redeploy a service"""
    client = get_client()
    try:
        client.redeploy_service(service_id, environment_id)
        console.print(f"[green]✓ Service {service_id} redeployed successfully[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to redeploy service: {e}[/red]")


@cli.command()
@click.argument("service_id")
@click.argument("environment_id")
@click.argument("command", nargs=-1, required=True)
def exec(service_id, environment_id, command):
    """Execute a command on a service"""
    client = get_client()
    try:
        result = client.execute_command(service_id, environment_id, list(command))
        cmd_result = result.get("executeCommand", {})

        console.print(f"Exit Code: {cmd_result.get('exitCode', 'N/A')}")
        console.print(Panel(cmd_result.get("output", ""), title="Output"))
    except Exception as e:
        console.print(f"[red]✗ Failed to execute command: {e}[/red]")


# === Log Commands ===

@cli.command()
@click.argument("project_id")
@click.argument("service_id")
@click.argument("environment_id")
@click.option("--limit", "-n", default=50, help="Number of log lines")
def logs(project_id, service_id, environment_id, limit):
    """Get runtime logs for a service"""
    client = get_client()
    try:
        result = client.get_runtime_logs(project_id, service_id, environment_id, limit)
        logs_list = result.get("runtimeLogs", [])

        if not logs_list:
            console.print("[yellow]No logs found[/yellow]")
            return

        for log in logs_list:
            timestamp = log.get("timestamp", "")
            message = log.get("message", "")
            console.print(f"[dim]{timestamp}[/dim] {message}")
    except Exception as e:
        console.print(f"[red]✗ Failed to get logs: {e}[/red]")


if __name__ == "__main__":
    cli()
