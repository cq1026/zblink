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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        const servicesConfig = env.SERVICES;
        if (!servicesConfig) {
            return jsonResponse({ success: true, accounts: [], services: [] }, 200, headers);
        }

        const config = JSON.parse(servicesConfig);

        // Return account names and services (without tokens)
        const accountNames = Object.keys(config.accounts || {});
        const services = (config.services || []).map(s => ({
            key: s.key,
            name: s.name,
            account: s.account
        }));

        return jsonResponse({
            success: true,
            accounts: accountNames,
            services: services
        }, 200, headers);
    } catch (error) {
        console.error('Error parsing services:', error);
        return jsonResponse({ success: false, error: 'Service configuration error' }, 500, headers);
    }
}

// Get status for all services
async function handleGetStatus(env, headers) {
    try {
        if (!env.SERVICES) {
            return jsonResponse({ success: true, statuses: {} }, 200, headers);
        }

        const config = JSON.parse(env.SERVICES);
        const statuses = {};

        // Fetch status for each service in parallel
        const statusPromises = config.services.map(async (service) => {
            const apiToken = config.accounts[service.account];
            if (!apiToken) return { key: service.key, status: 'UNKNOWN' };

            try {
                const result = await callZeaburAPI(apiToken, queries.serviceStatus, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                return {
                    key: service.key,
                    status: result.data?.service?.status || 'UNKNOWN'
                };
            } catch (error) {
                return { key: service.key, status: 'UNKNOWN' };
            }
        });

        const results = await Promise.all(statusPromises);
        results.forEach(r => {
            statuses[r.key] = r.status;
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
        const { password, serviceKey } = body;

        if (!password || password !== env.AUTH_PASSWORD) {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }

        if (!env.SERVICES) {
            return jsonResponse({ success: false, error: 'Service configuration error' }, 500, headers);
        }

        const config = JSON.parse(env.SERVICES);
        const service = config.services.find(s => s.key === serviceKey);

        if (!service) {
            return jsonResponse({ success: false, error: 'Service not found' }, 404, headers);
        }

        // Get token for this service's account
        const apiToken = config.accounts[service.account];
        if (!apiToken) {
            return jsonResponse({ success: false, error: 'Account token not found' }, 500, headers);
        }

        const result = await callZeaburAPI(apiToken, mutations[action], {
            serviceId: service.serviceId,
            environmentId: service.environmentId,
        });

        if (result.errors) {
            return jsonResponse({ success: false, error: result.errors[0]?.message || 'API call failed' }, 500, headers);
        }

        // Record stop time for keepalive (only if KV is bound)
        if (env.KV) {
            if (action === 'stop') {
                await env.KV.put(`stopped:${serviceKey}`, Date.now().toString());
            } else if (action === 'restart') {
                await env.KV.delete(`stopped:${serviceKey}`);
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
    if (!env.SERVICES || !env.KV) {
        console.log('Missing configuration or KV binding, skipping keepalive check');
        return;
    }

    const config = JSON.parse(env.SERVICES);
    const KEEPALIVE_DAYS = 20;
    const now = Date.now();

    for (const service of config.services) {
        const stoppedTime = await env.KV.get(`stopped:${service.key}`);

        if (!stoppedTime) continue;

        const daysStopped = (now - parseInt(stoppedTime)) / (1000 * 60 * 60 * 24);

        if (daysStopped >= KEEPALIVE_DAYS) {
            console.log(`Keepalive: ${service.name} has been stopped for ${Math.floor(daysStopped)} days`);

            const apiToken = config.accounts[service.account];
            if (!apiToken) {
                console.error(`No token found for account: ${service.account}`);
                continue;
            }

            try {
                await callZeaburAPI(apiToken, mutations.restart, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                console.log(`Restarted: ${service.name}`);
                await sleep(30000);

                await callZeaburAPI(apiToken, mutations.stop, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                console.log(`Stopped again: ${service.name}`);
                await env.KV.put(`stopped:${service.key}`, Date.now().toString());

            } catch (error) {
                console.error(`Keepalive failed for ${service.name}:`, error);
            }
        }
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
