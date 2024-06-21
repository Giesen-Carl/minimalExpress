import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import User from './database/model/userModel.js';
import Token from './database/model/tokenModel.js';

// Constants
const default_redirect = '/';
const token_duration = 3600000;
const token_length = 128;

// Router
const auth_router = express.Router();
auth_router.use(cookieParser());
auth_router.use(express.urlencoded({ extended: true }));
auth_router.use(express.json());
auth_router.use(redirect);

// Login routes
auth_router.route('/login')
    .get((req, res) => {
        res.render('login.ejs', { redirect: req.redirect_param });
    })
    .post(async (req, res) => {
        const { username, password } = req.body;
        try {
            const token = await login(username, password);
            res.cookie('token', token).redirect(req.redirect);
        } catch (error) {
            const data = { username: username, password: password, redirect: req.redirect_param, error: error.message };
            res.render('login.ejs', data);
        }
    });

// Signup routes
auth_router.route('/signup')
    .get((req, res) => {
        res.render('signup.ejs', { redirect: req.redirect_param });
    })
    .post(async (req, res) => {
        const { username, email, password, confirm_password } = req.body;
        try {
            const token = await signup(username, email, password, confirm_password);
            res.cookie('token', token).redirect(req.redirect);
        } catch (error) {
            const data = { username: username, email: email, password: password, confirm_password: confirm_password, redirect: req.redirect_param, error: error.message }
            res.render('signup.ejs', data);
        }
    });

// Logout route
auth_router.get('/logout', async (req, res) => {
    await logout(req.cookies.token);
    res.clearCookie('token').redirect('/login');
});

// Middleware to check if user is authenticated
export const auth = async (req, res, next) => {
    const token = req.cookies.token;
    try {
        const db_token = await Token.findByPk(token);
        if (!db_token) {
            throw new Error('no session found');
        }
        const expiration_date = new Date(db_token.expires);
        if (!isDateValid(expiration_date)) {
            throw new Error('session token corrupted');
        }
        if (expiration_date < new Date()) {
            await Token.destroy({ where: { token: token } });
            throw new Error('token expired');
        }
        req.username = db_token.username;
        next();
    } catch (error) {
        console.log(error.message)
        return res.redirect('/login?redirect=' + req.url);
    }
};

// Login function
async function login(username, password) {
    const expectedPassword = await User.findByPk(username);
    if (!expectedPassword) {
        throw new Error('No Account found with this username');
    }
    const hashedPassword = hash(password);
    if (!hashedPassword || expectedPassword.password !== hashedPassword) {
        throw new Error('wrong password entered');
    }
    return await generateToken(username);
}

// signup function
async function signup(username, email, password, confirm_password) {
    if (password !== confirm_password) {
        throw new Error('Passwords do not match');
    }
    const existingUser = await User.findByPk(username);
    if (existingUser) {
        throw new Error('User already exists');
    }
    const hashedPassword = hash(password);
    await User.create({ username: username, password: hashedPassword, email: email });
    return await generateToken(username);
}

// Logout function
async function logout(token) {
    await Token.destroy({ where: { token: token } });
}

// Create Hash
function hash(data) {
    const secret = process.env.PASSWORD_HASH_SECRET;
    if (!secret) {
        return new Error('Password hash secret not found');
    }
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Helper function to generate a token
async function generateToken(username) {
    const token = crypto.randomBytes(token_length).toString('hex');
    const expiration_date = new Date(Date.now() + parseInt(token_duration));
    await Token.destroy({ where: { username: username } });
    await Token.create({ token: token, username: username, expires: expiration_date });
    return token;
}

// Middleware to redirect
function redirect(req, res, next) {
    req.redirect = req.query.redirect ?? default_redirect;
    req.redirect_param = `?redirect=${req.redirect}`;
    next();
};

// Helper function to check if a date is valid
function isDateValid(dateStr) {
    return !isNaN(new Date(dateStr));
}

export default auth_router;