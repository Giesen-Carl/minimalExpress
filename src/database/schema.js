import { createTableIfNotExists, dropAll } from "./queries.js";
import datatypes from "./datatypes.js";

const schema = {
    Auth: {
        uuid: datatypes.UUID,
        password: datatypes.STRING,
    },
}


const setupDB = async () => {
    await dropAll();
    await createTableIfNotExists(schema);
}

export default setupDB;
