import 'dotenv/config';
import client from "./db_client.js";
import fs from 'node:fs';

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

export async function createDataFromJson() {
    try {
        const data = JSON.parse(fs.readFileSync('scripts/data/cocktails.json', 'utf8'));
        createCocktailsFromJSON(data);
    } catch (err) {
        console.log('ERROR:', err);
    }
}
async function createCocktailsFromJSON(data) {
    try {
        const messages = [];
        for (const [category, items] of Object.entries(data)) {
            for (const item of items) {
                try {
                    await createObject('Cocktail', {
                        name: item.name,
                        category: category,
                        price: item.price,
                    })
                    messages.push(`[+++] Cocktail ${item.name} was created successfully`);
                } catch (err) {
                    messages.push(`[XXX] Cocktail ${item.name} could not be created`)
                }
            }
        }
        for (const message of messages) {
            console.log(message);
        }
    } catch (err) {
        console.log(err)
    }
}

async function runQuery(query, queryName, values) {
    try {
        await client.query(query, values);
        console.log(`Query success:`, queryName);
    } catch (err) {
        console.log(`Query error:`, err);
    }
}