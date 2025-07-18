import 'dotenv/config';
import client from "./db_client.js";
import fs from 'node:fs';

const LOG_SUCCESSFUL_QUERIES = false;

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
    return await runQuery(query, 'Get all Cocktails')
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
    return await runQuery(query, 'Get Cocktail Ingredients')
}

export async function getAllIngredients() {
    const query = `SELECT * FROM ingredient`;
    return await runQuery(query, 'Get all Ingredients')
}

async function runQuery(query, queryName, values) {
    try {
        const res = await client.query(query, values);
        if (LOG_SUCCESSFUL_QUERIES) {
            console.log(`Query success:`, queryName);
        }
        return res.rows;
    } catch (err) {
        console.log(`Query error:`, err);
    }
}

export async function getPasswordFromUUID(uuid) {
    const query = `SELECT password FROM auth WHERE uuid = '${uuid}'`;
    const queryName = 'UUID -> Password'
    return (await runQuery(query, queryName))[0]
}

export async function getUserByUsername(username) {
    const query = `SELECT * FROM public.user WHERE username = '${username}'`;
    const queryName = 'Get User by username'
    return (await runQuery(query, queryName))[0]
}

export async function getUserByUUID(uuid) {
    const query = `SELECT * FROM public.user WHERE uuid = '${uuid}'`;
    const queryName = 'Get User by UUID'
    return (await runQuery(query, queryName))[0];
}

export async function createAuth(uuid, password) {
    await createObject('auth', { uuid, password });
}

export async function createUser(uuid, username, role) {
    await createObject('user', { uuid, username, role });
}

export async function updateUserRole(username, role) {
    const query = `UPDATE public.user
        SET role = '${role}'
        WHERE username = '${username}'`;
    const queryName = 'Update User Role'
    await runQuery(query, queryName);
}

export async function getAllBestellungen() {
    const query = `SELECT * FROM bestellung`;
    const queryName = 'Get all Bestellungen';
    return await runQuery(query, queryName);
}

export async function getBestellungenByUsername(username) {
    const query = `SELECT * FROM bestellung WHERE username = '${username}'`;
    const queryName = 'Get Bestellungen by Username';
    return await runQuery(query, queryName);
}

export async function getAdminUUIDs() {
    const query = `SELECT uuid FROM public.user WHERE role = 'ADMIN'`;
    const queryName = 'Get Admin UUIDs';
    return await runQuery(query, queryName);
}

export async function getBestellungByBestellungId(bestellung_id) {
    const query = `SELECT * FROM bestellung WHERE id = '${bestellung_id}'`;
    const queryName = 'Get Bestellung ID';
    return (await runQuery(query, queryName))[0];
}

export async function getUserByBestellungId(bestellung_id) {
    const query = `
        SELECT public.user.uuid, public.user.username, public.user.role
        FROM bestellung
        INNER JOIN public.user ON public.user.username = bestellung.username
        WHERE bestellung.id = '${bestellung_id}'
    `;
    const queryName = 'Get User by BestellungId';
    return (await runQuery(query, queryName))[0];
}

export async function getCocktailByName(cocktail_name) {
    const query = `SELECT * FROM cocktail WHERE cocktail_name = '${cocktail_name}'`;
    const queryName = 'Get Cocktail by Name';
    return (await runQuery(query, queryName))[0];
}

export async function completeBestellungByBestellungId(bestellung_id) {
    const query = `
        UPDATE bestellung
        SET status = 'FINISHED'
        WHERE bestellung.id = '${bestellung_id}'
    `;
    const queryName = 'Update Bestellung to Finished';
    return await runQuery(query, queryName);
}

export async function deleteBestellungByBestellungId(bestellung_id) {
    const query = `DELETE FROM bestellung WHERE id = '${bestellung_id}'`;
    const queryName = 'Delete Bestellung by ID';
    return await runQuery(query, queryName);
}

export async function deleteCocktailById(cocktail_id) {
    const query = `DELETE FROM cocktail WHERE id = '${cocktail_id}'`;
    const queryName = 'Delete Cocktail by ID';
    return await runQuery(query, queryName);
}

export async function deleteCocktailIngredientByCocktailId(cocktail_id) {
    const query = `DELETE FROM cocktail_ingredient WHERE cocktail_id = '${cocktail_id}'`;
    const queryName = 'Delete Cocktail Ingredient by Cocktail ID';
    return await runQuery(query, queryName);
}

export async function deleteIngredientById(ingredient_id) {
    const query = `DELETE FROM ingredient WHERE id = '${ingredient_id}'`;
    const queryName = 'Delete Ingredient by Id';
    return await runQuery(query, queryName);
}

export async function setIngredientAvailability(ingredient_id, available) {
    const query = `UPDATE ingredient SET available = ${available} WHERE id = '${ingredient_id}'`;
    const queryName = 'Set Ingredient Availability';
    return await runQuery(query, queryName);
}

export async function getBestellungenWithCocktails(username) {
    let db_res = [];
    if (username) {
        db_res = await getBestellungenWithCocktailByUsername(username);
    } else {
        db_res = await getAllBestellungenWithCocktails();
    }
    const bestell_ids = [];
    const bestellungen = db_res.map(b => {
        const ingredient_ids = [];
        const ingredients = db_res
            .filter(c => c.cocktail_name === b.cocktail_name)
            .map(c => {
                if (ingredient_ids.includes(c.ingredient_id)) {
                    return null;
                }
                ingredient_ids.push(c.ingredient_id);
                return {
                    ingredient_name: c.ingredient_name,
                    menge: c.menge,
                    available: c.available
                };
            })
            .filter(i => i !== null);
        return {
            id: b.id,
            timestamp: b.timestamp,
            username: b.username,
            cocktail_name: b.cocktail_name,
            status: b.status,
            ingredients: ingredients,
        };
    })
        .filter(b => {
            if (bestell_ids.includes(b.id)) {
                return false;
            } else {
                bestell_ids.push(b.id);
                return true;
            }
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return bestellungen;
}

async function getAllBestellungenWithCocktails() {
    const query = `
        SELECT bestellung.id, bestellung.username, bestellung.cocktail_name, bestellung.status, bestellung.timestamp, cocktail_ingredient.menge, ingredient.id as ingredient_id, ingredient.ingredient_name, ingredient.available
        FROM bestellung
        INNER JOIN cocktail ON bestellung.cocktail_name = cocktail.cocktail_name
        INNER JOIN cocktail_ingredient ON cocktail.id = cocktail_ingredient.cocktail_id
        INNER JOIN ingredient ON ingredient.id = cocktail_ingredient.ingredient_id
    `;
    const queryName = 'Get All Bestellungen with Cocktails';
    return await runQuery(query, queryName);
}

async function getBestellungenWithCocktailByUsername(username) {
    const query = `
        SELECT bestellung.id, bestellung.username, bestellung.cocktail_name, bestellung.status, bestellung.timestamp, cocktail_ingredient.menge, ingredient.id as ingredient_id, ingredient.ingredient_name, ingredient.available
        FROM bestellung
        INNER JOIN cocktail ON bestellung.cocktail_name = cocktail.cocktail_name
        INNER JOIN cocktail_ingredient ON cocktail.id = cocktail_ingredient.cocktail_id
        INNER JOIN ingredient ON ingredient.id = cocktail_ingredient.ingredient_id
        WHERE bestellung.username = '${username}'
    `;
    const queryName = 'Get All Bestellungen with Cocktails by Username';
    return await runQuery(query, queryName);
}
