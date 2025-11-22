"""
Zeabur API Client
A Python client for interacting with Zeabur's GraphQL API
"""

import requests
from typing import Optional, Dict, Any, List


class ZeaburClient:
    """Client for Zeabur GraphQL API"""

    API_ENDPOINT = "https://api.zeabur.com/graphql"

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    def _execute(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a GraphQL query/mutation"""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        response = requests.post(self.API_ENDPOINT, json=payload, headers=self.headers)
        response.raise_for_status()
        result = response.json()

        if "errors" in result:
            raise Exception(f"GraphQL Error: {result['errors']}")

        return result.get("data", {})

    # === User Operations ===

    def get_current_user(self) -> Dict[str, Any]:
        """Get current user information"""
        query = """
        query {
            me {
                _id
                username
                email
                name
            }
        }
        """
        return self._execute(query)

    # === Project Operations ===

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects"""
        query = """
        query {
            projects {
                _id
                name
                description
                createdAt
            }
        }
        """
        return self._execute(query)

    def get_project(self, project_id: str) -> Dict[str, Any]:
        """Get project details"""
        query = """
        query GetProject($projectId: ObjectID!) {
            project(_id: $projectId) {
                _id
                name
                description
                services {
                    _id
                    name
                    template
                }
                environments {
                    _id
                    name
                }
            }
        }
        """
        return self._execute(query, {"projectId": project_id})

    # === Service Operations ===

    def list_services(self, project_id: str) -> List[Dict[str, Any]]:
        """List all services in a project"""
        query = """
        query GetServices($projectId: ObjectID!) {
            project(_id: $projectId) {
                services {
                    _id
                    name
                    template
                    createdAt
                }
            }
        }
        """
        return self._execute(query, {"projectId": project_id})

    def restart_service(self, service_id: str, environment_id: str) -> Dict[str, Any]:
        """Restart a service"""
        mutation = """
        mutation RestartService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            restartService(serviceID: $serviceId, environmentID: $environmentId)
        }
        """
        return self._execute(mutation, {
            "serviceId": service_id,
            "environmentId": environment_id
        })

    def suspend_service(self, service_id: str, environment_id: str) -> Dict[str, Any]:
        """Suspend (stop) a service"""
        mutation = """
        mutation SuspendService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            suspendService(serviceID: $serviceId, environmentID: $environmentId)
        }
        """
        return self._execute(mutation, {
            "serviceId": service_id,
            "environmentId": environment_id
        })

    def resume_service(self, service_id: str, environment_id: str) -> Dict[str, Any]:
        """Resume (start) a suspended service"""
        mutation = """
        mutation ResumeService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            resumeService(serviceID: $serviceId, environmentID: $environmentId)
        }
        """
        return self._execute(mutation, {
            "serviceId": service_id,
            "environmentId": environment_id
        })

    def redeploy_service(self, service_id: str, environment_id: str) -> Dict[str, Any]:
        """Redeploy a service"""
        mutation = """
        mutation RedeployService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            redeployService(serviceID: $serviceId, environmentID: $environmentId)
        }
        """
        return self._execute(mutation, {
            "serviceId": service_id,
            "environmentId": environment_id
        })

    # === Command Execution ===

    def execute_command(self, service_id: str, environment_id: str, command: List[str]) -> Dict[str, Any]:
        """Execute a command on a service"""
        mutation = """
        mutation ExecuteCommand($serviceId: ObjectID!, $environmentId: ObjectID!, $command: [String!]!) {
            executeCommand(serviceID: $serviceId, environmentID: $environmentId, command: $command) {
                exitCode
                output
            }
        }
        """
        return self._execute(mutation, {
            "serviceId": service_id,
            "environmentId": environment_id,
            "command": command
        })

    # === Log Operations ===

    def get_runtime_logs(self, project_id: str, service_id: str, environment_id: str,
                         limit: int = 100) -> Dict[str, Any]:
        """Get runtime logs for a service"""
        query = """
        query RuntimeLogs($projectId: ObjectID!, $serviceId: ObjectID!, $environmentId: ObjectID!, $limit: Int) {
            runtimeLogs(projectID: $projectId, serviceID: $serviceId, environmentID: $environmentId, limit: $limit) {
                message
                timestamp
            }
        }
        """
        return self._execute(query, {
            "projectId": project_id,
            "serviceId": service_id,
            "environmentId": environment_id,
            "limit": limit
        })

    def get_build_logs(self, project_id: str, deployment_id: str) -> Dict[str, Any]:
        """Get build logs for a deployment"""
        query = """
        query BuildLogs($projectId: ObjectID!, $deploymentId: ObjectID!) {
            buildLogs(projectID: $projectId, deploymentID: $deploymentId) {
                message
                timestamp
            }
        }
        """
        return self._execute(query, {
            "projectId": project_id,
            "deploymentId": deployment_id
        })

    # === Environment Operations ===

    def get_environments(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all environments for a project"""
        query = """
        query GetEnvironments($projectId: ObjectID!) {
            project(_id: $projectId) {
                environments {
                    _id
                    name
                }
            }
        }
        """
        return self._execute(query, {"projectId": project_id})
