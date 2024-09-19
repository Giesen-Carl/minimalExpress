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

app.get('/cocktails', async (req, res) => {
    const cocktails = await Cocktail.findAll();
    const data = getData(cocktails)
    res.render('cocktails', { data })
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

app.post('/cocktails', async (req, res) => {
    try {
        const body = req.body;
        await Cocktail.create({
            name: body.name,
            category: body.category,
            price: body.price,
            description: body.description,
        });
        res.status(200).send("Cocktail erfolgreich Angelegt.")
    } catch (e) {
        console.log(e)
        res.status(500).send("Cocktail konnte nicht engelegt werden.");
    }
});

const start = async () => {
    await database.sync();
    httpsServer.listen(443, () => console.log(`Server is running at http://localhost:${443}`));
};

start();
