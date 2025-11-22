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

export default {
    // Handle HTTP requests
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // API routes
        if (path === '/api/services') {
            return handleGetServices(env, corsHeaders);
        }

        if (path === '/api/restart' || path === '/api/stop') {
            const action = path.split('/').pop();
            return handleAction(request, env, action, corsHeaders);
        }

        // Let assets handler serve static files
        return env.ASSETS.fetch(request);
    },

    // Handle scheduled cron trigger
    async scheduled(event, env, ctx) {
        console.log('Cron triggered: checking for services to keepalive');
        await checkKeepalive(env);
    }
};

// Get services list (public info only)
async function handleGetServices(env, headers) {
    try {
        const servicesConfig = env.SERVICES;
        if (!servicesConfig) {
            return jsonResponse({ success: true, services: [] }, 200, headers);
        }

        const services = JSON.parse(servicesConfig);
        const publicServices = services.map(s => ({
            key: s.key,
            name: s.name
        }));

        return jsonResponse({ success: true, services: publicServices }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: 'Service configuration error' }, 500, headers);
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

        // Verify password
        if (!password || password !== env.AUTH_PASSWORD) {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }

        // Check config
        if (!env.ZEABUR_API_TOKEN || !env.SERVICES) {
            return jsonResponse({ success: false, error: 'Service configuration error' }, 500, headers);
        }

        // Find service
        const services = JSON.parse(env.SERVICES);
        const service = services.find(s => s.key === serviceKey);

        if (!service) {
            return jsonResponse({ success: false, error: 'Service not found' }, 404, headers);
        }

        // Execute action
        const result = await callZeaburAPI(env, mutations[action], {
            serviceId: service.serviceId,
            environmentId: service.environmentId,
        });

        if (result.errors) {
            return jsonResponse({ success: false, error: result.errors[0]?.message || 'API call failed' }, 500, headers);
        }

        // Record stop time for keepalive
        if (action === 'stop') {
            await env.KV.put(`stopped:${serviceKey}`, Date.now().toString());
        } else if (action === 'restart') {
            // Clear stop time on manual restart
            await env.KV.delete(`stopped:${serviceKey}`);
        }

        return jsonResponse({ success: true, data: result.data }, 200, headers);

    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: 'Server error' }, 500, headers);
    }
}

// Check and keepalive services that have been stopped for too long
async function checkKeepalive(env) {
    if (!env.SERVICES || !env.ZEABUR_API_TOKEN) {
        console.log('Missing configuration, skipping keepalive check');
        return;
    }

    const services = JSON.parse(env.SERVICES);
    const KEEPALIVE_DAYS = 20;
    const now = Date.now();

    for (const service of services) {
        const stoppedTime = await env.KV.get(`stopped:${service.key}`);

        if (!stoppedTime) continue;

        const daysStopped = (now - parseInt(stoppedTime)) / (1000 * 60 * 60 * 24);

        if (daysStopped >= KEEPALIVE_DAYS) {
            console.log(`Keepalive: ${service.name} has been stopped for ${Math.floor(daysStopped)} days`);

            try {
                // Restart service
                await callZeaburAPI(env, mutations.restart, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                console.log(`Restarted: ${service.name}`);

                // Wait 30 seconds for service to start
                await sleep(30000);

                // Stop service again
                await callZeaburAPI(env, mutations.stop, {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                });

                console.log(`Stopped again: ${service.name}`);

                // Update stop time
                await env.KV.put(`stopped:${service.key}`, Date.now().toString());

            } catch (error) {
                console.error(`Keepalive failed for ${service.name}:`, error);
            }
        }
    }
}

// Call Zeabur GraphQL API
async function callZeaburAPI(env, query, variables) {
    const response = await fetch(ZEABUR_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.ZEABUR_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    return response.json();
}

// Helper functions
function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
