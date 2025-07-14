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
            await createObject('cocktail', {
                cocktail_name: item.name,
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
        await createObject('ingredient', {
            ingredient_name: ingredient,
            available: true,
        })
    }
}

async function createCocktailIngredientsFromJSON(data) {
    const cocktails = {};
    const ingredients = {};
    (await getAllCocktails()).forEach((c) => cocktails[c.cocktail_name] = c.id);
    (await getAllIngredients()).forEach((i) => ingredients[i.ingredient_name] = i.id);
    for (const items of Object.values(data)) {
        for (const item of items) {
            const cocktailName = item.name;
            for (const [ingredientName, menge] of Object.entries(item.ingredients)) {
                await createObject('cocktail_ingredient', {
                    cocktail_id: cocktails[cocktailName],
                    ingredient_id: ingredients[ingredientName],
                    menge: menge,
                });
            }
        }
    }
}

export async function getAllCocktails() {
    const query = `SELECT * FROM cocktail`;
    return (await runQuery(query, 'Get all Cocktails')).rows
}

export async function getAllCocktailsWithIngredients() {
    const cocktails = await getAllCocktails();
    const cwi = await Promise.all(cocktails.map(async (cocktail) => {
        const ingredients = await getIngredientsFromCocktail(cocktail.cocktail_name);
        return {
            ...cocktail,
            ingredients: ingredients.map((ing) => { return { name: ing.ingredient_name, menge: ing.menge } }),
            available: ingredients.every((ing) => ing.available === true),
        }
    }));
    return cwi;
}

export async function getIngredientsFromCocktail(cocktailName) {
    const query = `SELECT ingredient_name, menge, available
        FROM cocktail
        INNER JOIN cocktail_ingredient ON cocktail.id = cocktail_ingredient.cocktail_id
        INNER JOIN ingredient ON ingredient.id = cocktail_ingredient.ingredient_id
        WHERE cocktail_name = '${cocktailName}'`;
    return (await runQuery(query, 'Get Cocktail Ingredients')).rows
}

export async function getAllIngredients() {
    const query = `SELECT * FROM ingredient`;
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