import { createObject, createTableIfNotExists, dropAll } from "./queries.js";
import datatypes from "./datatypes.js";

const schema = {
    User: {
        uuid: datatypes.UUID,
        username: datatypes.STRING,
        role: datatypes.STRING,
    },
    Auth: {
        uuid: datatypes.UUID,
        password: datatypes.STRING,
    },
    Bestellung: {
        username: datatypes.STRING,
        cocktailName: datatypes.STRING,
        status: datatypes.STRING,
        timestamp: datatypes.DATETIME,
    },
    Cocktail: {
        name: datatypes.STRING,
        category: datatypes.STRING,
        price: datatypes.DOUBLE,
    },
    Igredient: {
        name: datatypes.STRING,
        available: datatypes.BOOL,
    },
    CocktailIngredient: {
        cocktailId: datatypes.INT,
        ingredientId: datatypes.INT,
        menge: datatypes.STRING,
    }
}


const setupDB = async () => {
    await dropAll();
    await createTableIfNotExists(schema);
    await createObject('Auth', {
        uuid: 'b60081db-fe14-4791-955e-f8e27f648e62',
        password: 'abcde',
    })
}

export default setupDB;
