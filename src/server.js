import 'dotenv/config';
import express from 'express';
import http from 'http';
import auth_router, { authUser, authws } from './auth_router.js';
import cocktailRouter from './cocktailRouter.js';
import bestellungRouter from './bestellungRouter.js';
import expressWs from 'express-ws';
import { init } from './database/db_client.js';
import { getAllCocktailsWithIngredients, getAllIngredients } from './database/queries.js';
import setupDB from './database/schema.js';
import ingredientRouter from './ingredientRouter.js';
import WebsocketManager from './websockerManager.js';

const CLEAN_DATABASE = false;

const app = express();
const httpServer = http.createServer(app);
expressWs(app, httpServer);
WebsocketManager.mount();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(auth_router);
app.use(cocktailRouter);
app.use(bestellungRouter);
app.use(ingredientRouter);

// app.get('/', authUser, async (req, res) => {
//     const cocktails = await getAllCocktailsWithIngredients();
//     const categories = [...new Set(cocktails.map(elem => elem.category))];
//     const data = categories.map(categoryName => {
//         return {
//             name: categoryName,
//             items: cocktails.filter(elem => elem.category === categoryName && elem.available === true)
//         }
//     })
//     const config = {
//         username: req.user?.username,
//         role: req.user?.role,
//         redirect: `?redirect=${req.url}`,
//     }
//     // res.render('cocktails copy', { data: data, config: config })
//     res.render('cocktails', { data: data, config: config })
// });

httpServer.on('upgrade', authws);

const start = async () => {
    await init();
    if (CLEAN_DATABASE) {
        await setupDB();
    }
    httpServer.listen(3000, () => console.log(`Server is running at http://localhost:${3000}`));
};

start();
