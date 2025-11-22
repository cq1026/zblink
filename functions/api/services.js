// Return list of configured services (without exposing IDs)

export async function onRequestGet(context) {
    const { env } = context;

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    try {
        // Parse services from environment variable
        // Format: JSON array of { key, name, serviceId, environmentId }
        const servicesConfig = env.SERVICES;

        if (!servicesConfig) {
            return new Response(
                JSON.stringify({ success: true, services: [] }),
                { status: 200, headers }
            );
        }

        const services = JSON.parse(servicesConfig);

        // Only return public info (key and name)
        const publicServices = services.map(s => ({
            key: s.key,
            name: s.name
        }));

        return new Response(
            JSON.stringify({ success: true, services: publicServices }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Error parsing services:', error);
        return new Response(
            JSON.stringify({ success: false, error: '服务配置错误' }),
            { status: 500, headers }
        );
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
