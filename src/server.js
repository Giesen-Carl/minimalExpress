import express from 'express';
import sequelize from './database/sqliteDatabaseConfig.js';
import auth_manager, { auth } from './auth/auth_manager.js';

const app = express();
const port = 3000;

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

const start = async () => {
    try {
        await sequelize.sync();
        app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

start();
