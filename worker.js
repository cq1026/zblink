const ZEABUR_API = 'https://api.zeabur.com/graphql';

const mutations = {
    restart: `
        mutation RestartService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            restartService(serviceID: $serviceId, environmentID: $environmentId)
        }
    `,
    stop: `
        mutation SuspendService($serviceId: ObjectID!, $environmentId: ObjectID!) {
            suspendService(serviceID: $serviceId, environmentID: $environmentId)
        }
    `
};

const queries = {
    serviceStatus: `
        query GetServiceStatus($serviceId: ObjectID!, $environmentId: ObjectID!) {
            service(_id: $serviceId) {
                status(environmentID: $environmentId)
            }
        }
    `
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (path === '/api/services') {
            return handleGetServices(env, corsHeaders);
        }

        if (path === '/api/status') {
            return handleGetStatus(env, corsHeaders);
        }

        if (path === '/api/restart' || path === '/api/stop') {
            const action = path.split('/').pop();
            return handleAction(request, env, action, corsHeaders);
        }

        if (path === '/api/config/add') {
            return handleAddService(request, env, corsHeaders);
        }

        if (path === '/api/config/delete') {
            return handleDeleteService(request, env, corsHeaders);
        }

        return env.ASSETS.fetch(request);
    },

    async scheduled(event, env, ctx) {
        console.log('Cron triggered: checking for services to keepalive');
        await checkKeepalive(env);
    }
};

// Get services list grouped by account
async function handleGetServices(env, headers) {
    try {
        const config = await getConfig(env);

        // Get unique account names
        const accountNames = [...new Set(config.services.map(s => s.account))];

        // Return account names and services (without tokens)
        const services = config.services.map(s => ({
            name: s.name,
            account: s.account
        }));

        return jsonResponse({
            success: true,
            accounts: accountNames,
            services: services
        }, 200, headers);
    } catch (error) {
        console.error('Error getting services:', error);
        return jsonResponse({ success: false, error: 'Service configuration error' }, 500, headers);
    }
}

// Get status for all services
async function handleGetStatus(env, headers) {
    try {
        const config = await getConfig(env);
        const statuses = {};

        // Fetch status for each service in parallel
        const statusPromises = config.services.map(async (service) => {
            if (!service.token) return { name: service.name, status: 'UNKNOWN' };

            try {
                const result = await callZeaburAPI(service.token, queries.serviceStatus, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                return {
                    name: service.name,
                    status: result.data?.service?.status || 'UNKNOWN'
                };
            } catch (error) {
                return { name: service.name, status: 'UNKNOWN' };
            }
        });

        const results = await Promise.all(statusPromises);
        results.forEach(r => {
            statuses[r.name] = r.status;
        });

        return jsonResponse({ success: true, statuses }, 200, headers);
    } catch (error) {
        console.error('Error getting statuses:', error);
        return jsonResponse({ success: false, error: 'Failed to get statuses' }, 500, headers);
    }
}

// Handle restart/stop actions
async function handleAction(request, env, action, headers) {
    if (!mutations[action]) {
        return jsonResponse({ success: false, error: 'Invalid action' }, 400, headers);
    }

    try {
        const body = await request.json();
        const { password, serviceName } = body;

        if (!password || password !== env.AUTH_PASSWORD) {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }

        const config = await getConfig(env);
        const service = config.services.find(s => s.name === serviceName);

        if (!service) {
            return jsonResponse({ success: false, error: 'Service not found' }, 404, headers);
        }

        if (!service.token) {
            return jsonResponse({ success: false, error: 'Service token not configured' }, 500, headers);
        }

        const result = await callZeaburAPI(service.token, mutations[action], {
            serviceId: service.serviceId,
            environmentId: service.environmentId,
        });

        if (result.errors) {
            return jsonResponse({ success: false, error: result.errors[0]?.message || 'API call failed' }, 500, headers);
        }

        // Record stop time for keepalive
        if (env.KV) {
            if (action === 'stop') {
                await env.KV.put(`stopped:${serviceName}`, Date.now().toString());
            } else if (action === 'restart') {
                await env.KV.delete(`stopped:${serviceName}`);
            }
        }

        return jsonResponse({ success: true, data: result.data }, 200, headers);

    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: 'Server error' }, 500, headers);
    }
}

// Check and keepalive services
async function checkKeepalive(env) {
    if (!env.KV) {
        console.log('KV not configured, skipping keepalive check');
        return;
    }

    try {
        const config = await getConfig(env);
        const KEEPALIVE_DAYS = 20;
        const now = Date.now();

        for (const service of config.services) {
            const stoppedTime = await env.KV.get(`stopped:${service.name}`);

            if (!stoppedTime) continue;

            const daysStopped = (now - parseInt(stoppedTime)) / (1000 * 60 * 60 * 24);

            if (daysStopped >= KEEPALIVE_DAYS) {
                console.log(`Keepalive: ${service.name} has been stopped for ${Math.floor(daysStopped)} days`);

                if (!service.token) {
                    console.error(`No token found for service: ${service.name}`);
                    continue;
                }

                try {
                    await callZeaburAPI(service.token, mutations.restart, {
                        serviceId: service.serviceId,
                        environmentId: service.environmentId,
                    });

                    console.log(`Restarted: ${service.name}`);
                    await sleep(30000);

                    await callZeaburAPI(service.token, mutations.stop, {
                        serviceId: service.serviceId,
                        environmentId: service.environmentId,
                    });

                    console.log(`Stopped again: ${service.name}`);
                    await env.KV.put(`stopped:${service.name}`, Date.now().toString());

                } catch (error) {
                    console.error(`Keepalive failed for ${service.name}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error in keepalive check:', error);
    }
}

// Call Zeabur GraphQL API
async function callZeaburAPI(token, query, variables) {
    const response = await fetch(ZEABUR_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    return response.json();
}

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get configuration from KV or fallback to env
async function getConfig(env) {
    if (!env.KV) {
        // Fallback to environment variable (backward compatibility)
        if (!env.SERVICES) {
            return { services: [] };
        }
        const oldConfig = JSON.parse(env.SERVICES);
        // Convert old format to new format
        return {
            services: (oldConfig.services || []).map(s => ({
                name: s.name,
                account: s.account,
                token: oldConfig.accounts?.[s.account] || '',
                serviceId: s.serviceId,
                environmentId: s.environmentId
            }))
        };
    }

    const configData = await env.KV.get('services_config');
    if (!configData) {
        return { services: [] };
    }

    return JSON.parse(configData);
}

// Save configuration to KV
async function saveConfig(env, config) {
    if (!env.KV) {
        throw new Error('KV binding not configured');
    }
    await env.KV.put('services_config', JSON.stringify(config));
}

// Add a new service
async function handleAddService(request, env, headers) {
    try {
        const body = await request.json();
        const { password, name, account, token, serviceId, environmentId } = body;

        if (!password || password !== env.AUTH_PASSWORD) {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }

        if (!name || !account || !token || !serviceId || !environmentId) {
            return jsonResponse({ success: false, error: 'All fields are required' }, 400, headers);
        }

        const config = await getConfig(env);

        // Check if service with same name already exists
        if (config.services.some(s => s.name === name)) {
            return jsonResponse({ success: false, error: 'Service with this name already exists' }, 400, headers);
        }

        // Add new service
        config.services.push({
            name,
            account,
            token,
            serviceId,
            environmentId
        });

        await saveConfig(env, config);

        return jsonResponse({ success: true }, 200, headers);
    } catch (error) {
        console.error('Error adding service:', error);
        return jsonResponse({ success: false, error: 'Server error' }, 500, headers);
    }
}

// Delete a service
async function handleDeleteService(request, env, headers) {
    try {
        const body = await request.json();
        const { password, serviceName } = body;

        if (!password || password !== env.AUTH_PASSWORD) {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }

        const config = await getConfig(env);

        const initialLength = config.services.length;
        config.services = config.services.filter(s => s.name !== serviceName);

        if (config.services.length === initialLength) {
            return jsonResponse({ success: false, error: 'Service not found' }, 404, headers);
        }

        await saveConfig(env, config);

        // Also delete stopped status from KV
        if (env.KV) {
            await env.KV.delete(`stopped:${serviceName}`);
        }

        return jsonResponse({ success: true }, 200, headers);
    } catch (error) {
        console.error('Error deleting service:', error);
        return jsonResponse({ success: false, error: 'Server error' }, 500, headers);
    }
}
