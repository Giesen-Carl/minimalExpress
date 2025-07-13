import pkg from "pg";
const { Client } = pkg;
import setupDB from "./schema.js";

const client = new Client({
    user: "admin",
    password: process.env.POSTGRES_PASSWORD,
    database: "express_db",
    host: "localhost",
    port: 5432,
});

export async function init() {
    await connect();
    await setupDB();
    process.on('SIGINT', disconnect);
    process.on('SIGTERM', disconnect);
}
async function connect() {
    await client.connect();
    console.log('Connected');
}
function disconnect() {
    client.end()
        .then(() => console.log('Disconnected'))
        .catch((err) => console.log('ERROR', err));
}

export default client;