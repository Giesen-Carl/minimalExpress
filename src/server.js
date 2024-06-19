import express from 'express';
import sequelize from './database/sqliteDatabaseConfig.js';
import auth_manager, { auth, auth_db } from './auth/auth_manager.js';
import 'dotenv/config';
import https from 'https';
import fs from 'fs';

const privateKey = fs.readFileSync('cert/key.pem', 'utf8');
const certificate = fs.readFileSync('cert/cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(auth_manager);

app.get('/', auth, (req, res) => {
    const name = req.username ?? 'noName';
    res.render('home', { name: name });
});

app.get('/about', auth, (req, res) => {
    res.render('about');
});

const httpsServer = https.createServer(credentials, app);
const start = async () => {
    try {
        await sequelize.sync();
        await auth_db.sync();
        httpsServer.listen(443, () => console.log(`Server is running at http://localhost:${443}`));
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

start();
