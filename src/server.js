import 'dotenv/config';
import express from 'express';
import https from 'https';
import fs from 'fs';
import auth_router, { auth } from './auth_router.js';
import database from './database/database.js';
import Cocktail from './database/model/cocktailModel.js';

const privateKey = fs.readFileSync('cert/key.pem', 'utf8');
const certificate = fs.readFileSync('cert/cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(auth_router);

app.get('/', async (req, res) => {
    const cocktails = await Cocktail.findAll();
    const data = getData(cocktails)
    const config = {
        showDeleteButtons: true,
        redirect: `?redirect=${req.url}`
    }
    res.render('cocktails', { data: data, config: config })
});

function getData(cocktails) {
    const categories = [...new Set(cocktails.map(elem => elem.category))];
    const data = categories.map(cat => {
        return { name: cat, items: getCategory(cocktails, cat) }
    })
    return data;
}

function getCategory(cocktails, categoryName) {
    return cocktails.filter(elem => elem.category === categoryName).map(mapDescription);
}
function mapDescription(cocktail) {
    return {
        name: cocktail.name,
        price: cocktail.price,
        description: cocktail.description.split(','),
    }
}
app.route('/cocktails')
    .get((req, res) => {
        res.render('createCocktail.ejs');
    })
    .post(async (req, res) => {
        try {
            const body = req.body;
            await Cocktail.create({
                name: body.name,
                category: body.category,
                price: body.price,
                description: body.description,
            });
            res.redirect('/');
        } catch (e) {
            console.log(e)
            res.render('createCocktail.ejs');
        }
    });

app.post('/cocktails/delete/:name', async (req, res) => {
    const paramName = req.params.name;
    try {
        const cocktail = await Cocktail.findOne({ where: { name: paramName } })
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
