import { createDataFromJson, createObject, createTableIfNotExists, dropAll } from "./queries.js";
import datatypes from "./datatypes.js";

const schema = {
    user: {
        uuid: datatypes.UUID,
        username: datatypes.STRING,
        role: datatypes.STRING,
    },
    auth: {
        uuid: datatypes.UUID,
        password: datatypes.STRING,
    },
    bestellung: {
        username: datatypes.STRING,
        cocktail_name: datatypes.STRING,
        status: datatypes.STRING,
        timestamp: datatypes.DATETIME,
    },
    cocktail: {
        cocktail_name: datatypes.STRING,
        category: datatypes.STRING,
        price: datatypes.DOUBLE,
    },
    ingredient: {
        ingredient_name: datatypes.STRING,
        available: datatypes.BOOL,
    },
    cocktail_ingredient: {
        cocktail_id: datatypes.INT,
        ingredient_id: datatypes.INT,
        menge: datatypes.STRING,
    }
}


const setupDB = async () => {
    console.log('Setting up database...');
    await dropAll();
    await createTableIfNotExists(schema);
    await createDataFromJson();
    console.log('Setup Complete')
}

export default setupDB;
