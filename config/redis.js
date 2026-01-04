import redis from "redis";

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

client.on("connect", () => {
  console.error("Redis Connected Successfully...!");
  console.error("==========================================");
});

client.on("error", (err) => {
  console.error("Redis Error : ", err);
  console.error("==========================================");
});

client.connect();

export default client;
