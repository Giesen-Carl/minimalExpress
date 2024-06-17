import express from 'express';
import cookieParser from 'cookie-parser';
import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const default_redirect = '/';
const token_duration = 1000 * 60 * 5;

// Router
const auth_manager = express.Router();
auth_manager.use(express.static(`${__dirname}/public`));
auth_manager.use(cookieParser());
auth_manager.use(express.urlencoded({ extended: true }));
auth_manager.use(express.json());

// Database setup
export const auth_db = new Sequelize({
    dialect: 'sqlite',
    storage: 'auth.sqlite'
});

const LoginData = auth_db.define('LoginData', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    }
});

const Token = auth_db.define('Token', {
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expires: {
        type: DataTypes.DATE,
        allowNull: false,
    }
});

// Login routes
auth_manager.route('/login')
    .get((req, res) => {
        const redirect = req.query.redirect ? `?redirect=${req.query.redirect}` : null;
        res.render(`${__dirname}/views/login.ejs`, { redirect: redirect });
    })
    .post(async (req, res) => {
        const { username, password } = req.body;
        const redirect = req.query.redirect;
        const redirect_param = req.query.redirect ? `?redirect=${req.query.redirect}` : null;
        const expectedPassword = await LoginData.findByPk(username);
        const hashedPassword = hash(password);
        if (!expectedPassword || !hashedPassword || expectedPassword.password !== hashedPassword) {
            return res.render(`${__dirname}/views/login.ejs`, { username: username, password: password, redirect: redirect_param, error: 'Invalid username or password' });
        }
        const session = await Token.findOne({ where: { username: username } });
        if (session) {
            await Token.destroy({ where: { username: username } });
        }
        const token = await generateToken(username);
        res.cookie('token', token).redirect(redirect ?? default_redirect);
    });

// Register routes
auth_manager.route('/register')
    .get((req, res) => {
        const redirect = req.query.redirect ? `?redirect=${req.query.redirect}` : null;
        res.render(`${__dirname}/views/register.ejs`, { redirect: redirect });
    })
    .post(async (req, res) => {
        const { username, password, passwordRepeat } = req.body;
        const redirect = req.query.redirect;
        const redirect_param = req.query.redirect ? `?redirect=${req.query.redirect}` : null;
        if (password !== passwordRepeat) {
            return res.render(`${__dirname}/views/register.ejs`, { username: username, password: password, passwordRepeat: passwordRepeat, redirect: redirect_param, error: 'Passwords do not match' });
        }
        const existingUser = await LoginData.findByPk(username);
        if (existingUser) {
            return res.render(`${__dirname}/views/register.ejs`, { username: username, password: password, passwordRepeat: passwordRepeat, redirect: redirect_param, error: 'User already exists' });
        }
        const hashedPassword = hash(password);
        await LoginData.create({ username: username, password: hashedPassword });
        const token = await generateToken(username);
        res.cookie('token', token).redirect(redirect ?? default_redirect);
    });

// Logout route
auth_manager.get('/logout', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        await Token.destroy({ where: { token: token } });
    }
    res.clearCookie('token').redirect('/login');
});

// Helper function to generate a token
async function generateToken(username) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters[randomIndex];
    }
    const expiration_date = new Date(Date.now() + token_duration);
    await Token.create({ token: token, username: username, expires: expiration_date });
    return token;
}

// Middleware to check if user is authenticated
export const auth = async (req, res, next) => {
    const token = req.cookies.token;
    const db_token = await Token.findByPk(token);
    if (!db_token || new Date(db_token.expires) < new Date()) {
        if (db_token) {
            await Token.destroy({ where: { token: token } });
        }
        return res.redirect('/login?redirect=' + req.url);
    }
    req.username = db_token.username;
    next();
};

// Create Hash
function hash(data) {
    const secret = process.env.PASSWORD_HASH_SECRET;
    if (!secret || !data) {
        return null;
    }
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export default auth_manager;