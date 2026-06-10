const Redis = require('ioredis');
const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  const allKeys = await redis.keys('*');
  console.log(`All Redis keys (${allKeys.length}):`, allKeys);
  
  const failedJobs = await redis.zrange('bull:flow-jobs:failed', 0, -1);
  console.log(`\nFailed BullMQ jobs in 'flow-jobs' (${failedJobs.length}):`);
  for (const jobId of failedJobs) {
    const jobData = await redis.hgetall(`bull:flow-jobs:${jobId}`);
    console.log(`- JobId: ${jobId}`);
    console.log(`  Name: ${jobData.name}`);
    console.log(`  Data: ${jobData.data}`);
    console.log(`  FailedReason: ${jobData.failedReason}`);
  }
  
  redis.quit();
}

main().catch(console.error);
