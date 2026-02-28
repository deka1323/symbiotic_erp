import { createClient } from 'redis'

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('🔌 [Redis] Initializing Redis connection...')
console.log('📍 [Redis] Connection URL:', redisUrl)

export const redis =
  globalForRedis.redis ??
  createClient({
    url: redisUrl,
  })

if (!globalForRedis.redis) {
  // Connection event handlers
  redis.on('connect', () => {
    console.log('✅ [Redis] Client connecting to server...')
  })

  redis.on('ready', () => {
    console.log('✅ [Redis] Client connected and ready to receive commands')
    console.log('✅ [Redis] Connection established successfully!')
  })

  redis.on('error', (err) => {
    console.error('❌ [Redis] Client Error:', err.message)
    console.error('❌ [Redis] Error Details:', {
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port,
    })
    console.error('❌ [Redis] Full Error:', err)
    
    // Provide troubleshooting tips
    console.log('\n🔧 [Redis] Troubleshooting Tips:')
    console.log('   1. Check if Redis server is running: redis-cli ping')
    console.log('   2. Verify Redis URL in .env file:', redisUrl)
    console.log('   3. Check if port 6379 is available')
    console.log('   4. Ensure Redis is accessible at:', redisUrl)
    console.log('   5. Try starting Redis: redis-server\n')
  })

  redis.on('end', () => {
    console.warn('⚠️  [Redis] Connection ended')
  })

  redis.on('reconnecting', () => {
    console.log('🔄 [Redis] Reconnecting to server...')
  })

  // Attempt to connect
  console.log('🔄 [Redis] Attempting to connect...')
  redis
    .connect()
    .then(() => {
      console.log('✅ [Redis] Successfully connected to Redis server!')
      console.log('✅ [Redis] Connection URL:', redisUrl)
    })
    .catch((err) => {
      console.error('❌ [Redis] Failed to connect:', err.message)
      console.error('❌ [Redis] Connection Error Details:', {
        name: err.name,
        code: err.code,
        message: err.message,
      })
      console.error('\n🔧 [Redis] Connection Failed - Troubleshooting:')
      console.error('   1. Is Redis server running? Check with: redis-cli ping')
      console.error('   2. Is the Redis URL correct? Current:', redisUrl)
      console.error('   3. Is port 6379 blocked by firewall?')
      console.error('   4. Try starting Redis server: redis-server')
      console.error('   5. For Docker: docker run -d -p 6379:6379 redis:latest\n')
    })

  globalForRedis.redis = redis
} else {
  console.log('✅ [Redis] Using existing Redis connection')
}

// Helper function to check connection status
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const result = await redis.ping()
    if (result === 'PONG') {
      console.log('✅ [Redis] Connection check: PONG - Redis is connected and responding')
      return true
    } else {
      console.warn('⚠️  [Redis] Connection check: Unexpected response:', result)
      return false
    }
  } catch (error: any) {
    console.error('❌ [Redis] Connection check failed:', error.message)
    return false
  }
}

export default redis
