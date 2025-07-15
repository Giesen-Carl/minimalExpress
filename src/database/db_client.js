import pkg from "pg";
const { Client } = pkg;

const db_config = {
    development: {
        user: "admin",
        password: process.env.POSTGRES_PASSWORD,
        database: "express_db",
        host: "localhost",
        port: 5432,
    },
    production: {
        user: "admin",
        password: process.env.POSTGRES_PASSWORD,
        database: "express_db",
        host: "postgres_container",
        port: 5432,
    }
}
const env = process.env.NODE_ENV || 'development';
const client = new Client(db_config[env]);

export async function init() {
    await connect();
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