import client from "./db_client.js";

export async function dropAll() {
    const dropSchemaQuery = 'DROP SCHEMA public CASCADE;'
    const createSchemaQuery = 'CREATE SCHEMA public;'
    await runQuery(dropSchemaQuery, 'Drop Schema')
    await runQuery(createSchemaQuery, 'Create Public Schema')
}

export async function createTableIfNotExists(schema) {
    for (const [tableName, columns] of Object.entries(schema)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }

        const columnDefs = [];

        for (const [colName, colType] of Object.entries(columns)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)) {
                throw new Error(`Invalid column name: ${colName} in table ${tableName}`);
            }

            columnDefs.push(`"${colName}" ${colType}`);
        }

        // Add id column as auto-incrementing primary key
        const createQuery = `
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          ${columnDefs.join(',\n  ')}
        );
      `;

        runQuery(createQuery, `CREATE Table ${tableName}`);
    }
}

export async function createObject(tableName, item) {
    const columns = Object.keys(item);
    const values = Object.values(item);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;
    await runQuery(query, 'Create Object', values);
}

async function runQuery(query, queryName, values) {
    try {
        await client.query(query, values);
        console.log(`Query success:`, queryName);
    } catch (err) {
        console.log(`Query error:`, err);
    }
}