import 'dotenv/config';
import express from 'express';
import https from 'https';
import fs from 'fs';
import auth_router, { authUser, validateRole } from './auth_router.js';
import cocktailRouter from './cocktailRouter.js';
import database from './database/database.js';
import Cocktail from './database/model/cocktailModel.js';
import Bestellung from './database/model/bestellungModel.js';

const privateKey = fs.readFileSync('cert/key.pem', 'utf8');
const certificate = fs.readFileSync('cert/cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(auth_router);
app.use(cocktailRouter);

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
        username: req.user?.username
    }
    res.render('cocktails', { data: data, config: config })
});

app.post('/bestellung', authUser, validateRole('USER'), async (req, res) => {
    const body = req.body;
    const username = body.username;
    const cocktail = body.cocktail;
    await Bestellung.create({ username, cocktail })
    res.status(200).redirect(req.query.redirect);
});

app.post('/bestellung/delete/:name', async (req, res) => {
    const paramName = req.params.name;
    try {
        const Bestellung = await Bestellung.findOne({ where: { name: paramName } })
        await cocktail.destroy();
    } catch (e) {
        console.log(e);
    }
    console.log(req.query)
    res.redirect('/')
});

const start = async () => {
    await database.sync();
    httpsServer.listen(443, () => console.log(`Server is running at http://localhost:${443}`));
};

start();
