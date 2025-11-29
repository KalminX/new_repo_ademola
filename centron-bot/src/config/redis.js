import redis from 'redis';

//
// ---------------
// Redis Client
// ---------------
// Works inside Docker (redis://redis:6379)
// Works locally (redis://localhost:6379)
//

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = redis.createClient({
    url: redisUrl,
    socket: {
        connectTimeout: 10_000, // 10s
        keepAlive: 5_000,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('❌ Redis: Max reconnection attempts reached');
                return new Error('Redis reconnect limit reached');
            }

            const delay = Math.min(retries * 200, 5000); // exponential backoff
            console.log(`🔄 Redis: reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
        }
    }
});

//
// ---------------
// Event Listeners
// ---------------
//

redisClient.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
});

redisClient.on('connect', () => {
    console.log('🔌 Redis: Connecting...');
});

redisClient.on('ready', () => {
    console.log('✅ Redis: Connected & Ready');
});

redisClient.on('reconnecting', () => {
    console.log('🔁 Redis: Reconnecting...');
});

redisClient.on('end', () => {
    console.log('⚠️ Redis: Connection Closed');
});

//
// ---------------
// Manual Connect
// ---------------
//

async function connectRedis() {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('❌ Redis: Initial connection failed:', err.message);
        // Do NOT exit — reconnectStrategy will handle future retries
    }
}

connectRedis();

export default redisClient;

