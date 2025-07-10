import 'dotenv/config';
import express from 'express';
import http from 'http';
import auth_router, { authUser, authws } from './auth_router.js';
import cocktailRouter from './cocktailRouter.js';
import database from './database/database.js';
import Cocktail from './database/model/cocktailModel.js';
import bestellungRouter from './bestellungRouter.js';
import { mountBestellungRouter } from './bestellungRouter.js';
import expressWs from 'express-ws';

const app = express();
const httpServer = http.createServer(app);
expressWs(app, httpServer);
mountBestellungRouter();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(auth_router);
app.use(cocktailRouter);
app.use(bestellungRouter);

app.get('/', authUser, async (req, res) => {
    const cocktails = await Cocktail.findAll();
    const categories = [...new Set(cocktails.map(elem => elem.category))];
    const data = categories.map(categoryName => {
        return {
            name: categoryName, items: cocktails.filter(elem => elem.category === categoryName).map(cocktail => {
                return {
                    cocktailIdent: cocktail.cocktailIdent,
                    price: cocktail.price,
                    description: cocktail.description.split(','),
                }
            })
        }
    })
    const config = {
        role: req.user?.role,
        redirect: `?redirect=${req.url}`,
        username: req.user?.username,
    }
    res.render('cocktails', { data: data, config: config })
});

httpServer.on('upgrade', authws);

const start = async () => {
    await database.sync();
    httpServer.listen(3000, () => console.log(`Server is running at http://localhost:${3000}`));
};

start();
