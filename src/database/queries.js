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
        const data = JSON.parse(fs.readFileSync('src/database/data.json', 'utf8'));
        await createCocktailsFromJSON(data);
        await createIngredientsFromJSON(data);
        await createCocktailIngredientsFromJSON(data);
    } catch (err) {
        console.log('ERROR:', err);
    }
}

async function createCocktailsFromJSON(data) {
    for (const [category, items] of Object.entries(data)) {
        for (const item of items) {
            await createObject('Cocktail', {
                name: item.name,
                category: category,
                price: item.price,
            })
        }
    }
}

async function createIngredientsFromJSON(data) {
    const ingredientSet = new Set();
    for (const items of Object.values(data)) {
        for (const item of items) {
            for (const key of Object.keys(item.ingredients)) {
                ingredientSet.add(key);
            }
        }
    }
    for (const ingredient of Array.from(ingredientSet)) {
        await createObject('Ingredient', {
            name: ingredient,
            available: true,
        })
    }
}

async function createCocktailIngredientsFromJSON(data) {
    const cocktails = {};
    const ingredients = {};
    (await getAllCocktails()).forEach((c) => cocktails[c.name] = c.id);
    (await getAllIngredients()).forEach((i) => ingredients[i.name] = i.id);
    for (const items of Object.values(data)) {
        for (const item of items) {
            const cocktailName = item.name;
            for (const [ingredientName, menge] of Object.entries(item.ingredients)) {
                await createObject('CocktailIngredient', {
                    cocktailId: cocktails[cocktailName],
                    ingredientId: ingredients[ingredientName],
                    menge: menge,
                });
            }
        }
    }
}

async function getAllCocktails() {
    const query = `SELECT * FROM "Cocktail"`;
    return (await runQuery(query, 'Get all Cocktails')).rows
}

async function getAllIngredients() {
    const query = `SELECT * FROM "Ingredient"`;
    return (await runQuery(query, 'Get all Ingredients')).rows
}

async function runQuery(query, queryName, values) {
    try {
        const res = await client.query(query, values);
        console.log(`Query success:`, queryName);
        return res;
    } catch (err) {
        console.log(`Query error:`, err);
    }
}