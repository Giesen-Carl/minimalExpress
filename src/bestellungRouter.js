import express from 'express';
import { authUser, Role, validateRole } from './auth_router.js';
import cookieParser from 'cookie-parser';
import Bestellung from './database/model/bestellungModel.js';
import User from './database/model/userModel.js';
import Cocktail from './database/model/cocktailModel.js';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';

const bestellungRouter = express.Router();
bestellungRouter.use(cookieParser());
bestellungRouter.use(express.urlencoded({ extended: true }));
bestellungRouter.use(bodyParser.json());
bestellungRouter.use(redirect);

bestellungRouter.post(
    '/bestellung/:cocktailIdent',
    authUser,
    validateRole(Role.USER),
    async (req, res) => {
        try {
            await bestellungHinzufuegen(req.params.cocktailIdent, req.user.username)
        } catch (error) {
            console.log(error)
        }
        res.status(200).redirect(req.query.redirect);
    });
bestellungRouter.post(
    '/bestellung/delete/:cocktailIdent/:username',
    authUser,
    validateRole(Role.ADMIN),
    async (req, res) => {
        try {
            const params = req.params;
            await bestellungEntfernen(params.cocktailIdent, params.username);
        } catch (error) {}
        res.redirect(req.query.redirect)
    });

async function bestellungHinzufuegen(cocktailIdent, username) {
    if (!username) {
        throw new Error('No username provided');
    }
    if (!cocktailIdent) {
        throw new Error('No CocktailIdent provided');
    }
    const existingUser = await User.findOne({ where: { username: username } });
    if (!existingUser) {
        throw new Error(`The user ${username} does not exist.`);
    }
    const existingCocktail = await Cocktail.findOne({ where: { cocktailIdent: cocktailIdent } });
    if (!existingCocktail) {
        throw new Error(`The Cocktail ${cocktailIdent} does not exist.`);
    }
    await Bestellung.create({ username: username, cocktail: cocktailIdent })
}

async function bestellungEntfernen(cocktailIdent, username) {
    const existingBestellung = await Bestellung.findOne({ where: { username: username, cocktail: cocktailIdent } });
    if (!existingBestellung) {
        throw new Error(`Es existiert keine Bestellung für ${cocktailIdent} von ${username}`);
    }
    await existingBestellung.destroy();
}

export default bestellungRouter;