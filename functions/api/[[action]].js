// Cloudflare Pages Function for Zeabur API operations

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

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const action = params.action;

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    // Validate action
    if (!mutations[action]) {
        return new Response(
            JSON.stringify({ success: false, error: 'Invalid action' }),
            { status: 400, headers }
        );
    }

    try {
        const body = await request.json();
        const { password, serviceKey } = body;

        // Verify password
        if (!password || password !== env.AUTH_PASSWORD) {
            return new Response(
                JSON.stringify({ success: false, error: '密码错误' }),
                { status: 401, headers }
            );
        }

        // Check required environment variables
        if (!env.ZEABUR_API_TOKEN || !env.SERVICES) {
            return new Response(
                JSON.stringify({ success: false, error: 'Service configuration error' }),
                { status: 500, headers }
            );
        }

        // Find service by key
        const services = JSON.parse(env.SERVICES);
        const service = services.find(s => s.key === serviceKey);

        if (!service) {
            return new Response(
                JSON.stringify({ success: false, error: 'Service not found' }),
                { status: 404, headers }
            );
        }

        // Execute Zeabur API call
        const response = await fetch(ZEABUR_API, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.ZEABUR_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: mutations[action],
                variables: {
                    serviceId: service.serviceId,
                    environmentId: service.environmentId,
                }
            }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error('Zeabur API error:', result.errors);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: result.errors[0]?.message || 'API call failed'
                }),
                { status: 500, headers }
            );
        }

        return new Response(
            JSON.stringify({ success: true, data: result.data }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: 'Server error' }),
            { status: 500, headers }
        );
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
