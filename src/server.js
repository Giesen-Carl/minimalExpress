import express from 'express';
import sequelize from './database/sqliteDatabaseConfig.js';
import auth_manager, { auth, auth_db } from './auth/auth_manager.js';
import 'dotenv/config';

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

const port = process.env.PORT;
const start = async () => {
    try {
        await sequelize.sync();
        await auth_db.sync();
        app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

start();
