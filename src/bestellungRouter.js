import express from 'express';
import { auth, authUser, Role, validateRole } from './auth_router.js';
import { completeBestellungByBestellungId, createObject, deleteBestellungByBestellungId, getAdminUUIDs, getBestellungByBestellungId, getBestellungenWithCocktails, getCocktailByName, getUserByBestellungId, getUserByUsername } from './database/queries.js';
import WebsocketManager from './websockerManager.js';

const BestellStatus = {
    IN_PROGRESS: 'IN_PROGRESS',
    FINISHED: 'FINISHED',
}

const bestellungRouter = express.Router();
const dataSend = async (user) => {
    const bestellungen = await findBestellungenByUser(user);
    return JSON.stringify(bestellungen);
}
const wm = new WebsocketManager(bestellungRouter, '/bestellung', dataSend);

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

bestellungRouter.get('/bestellung', auth, async (req, res) => {
    const config = {
        username: req.user.username,
        role: req.user.role,
    };
    res.render('bestellungen', { config })
});

async function findBestellungenByUser(user) {
    let bestellungen;
    if (user.role === Role.USER || user.role === Role.ADMIN) {
        const username = user.role === Role.USER ? user.username : undefined;
        bestellungen = await getBestellungenWithCocktails(username);
    }
    return bestellungen || [];
}

async function sendBestellungUpdateToClients(user) {
    const adminUUIDs = await getAdminUUIDs();
    const notifyUsers = [...adminUUIDs, user];
    await wm.sendUpdateToClients(notifyUsers)
}

bestellungRouter.post(
    '/bestellung/:cocktail_name',
    authUser,
    validateRole(Role.USER),
    async (req, res) => {
        try {
            await bestellungHinzufuegen(req.params.cocktail_name, req.user.username)
            await sendBestellungUpdateToClients(req.user);
        } catch (error) {
            console.log(error)
        }
        res.sendStatus(200);
    });
bestellungRouter.delete(
    '/bestellung/:bestellung_id',
    authUser,
    validateRole(Role.USER),
    async (req, res) => {
        try {
            const params = req.params;
            const user = await getUserByBestellungId(params.bestellung_id);
            await bestellungEntfernen(params.bestellung_id);
            await sendBestellungUpdateToClients(user);
        } catch (error) {}
        res.sendStatus(200);
    });
bestellungRouter.post(
    '/bestellung/complete/:bestellung_id',
    authUser,
    validateRole(Role.ADMIN),
    async (req, res) => {
        try {
            const params = req.params;
            const user = await getUserByBestellungId(params.bestellung_id);
            await bestellungAbschliessen(params.bestellung_id);
            await sendBestellungUpdateToClients(user);
        } catch (error) {}
        res.sendStatus(200);
    });

async function bestellungHinzufuegen(cocktail_name, username) {
    if (!username) {
        throw new Error('No username provided');
    }
    if (!cocktail_name) {
        throw new Error('No CocktailIdent provided');
    }
    const user = await getUserByUsername(username);
    if (!user) {
        throw new Error(`The user ${username} does not exist.`);
    }
    const cocktail = await getCocktailByName(cocktail_name);
    if (!cocktail) {
        throw new Error(`The Cocktail ${cocktail_name} does not exist.`);
    }
    await createObject('bestellung', {
        username: username,
        cocktail_name: cocktail_name,
        status: BestellStatus.IN_PROGRESS,
        timestamp: new Date(),
    })
}

async function bestellungEntfernen(bestellung_id) {
    const bestellung = await getBestellungByBestellungId(bestellung_id);
    if (!bestellung) {
        throw new Error(`Es existiert keine Bestellung für ${cocktail_name} von ${username}`);
    }
    await deleteBestellungByBestellungId(bestellung_id);
}

async function bestellungAbschliessen(bestellung_id) {
    const bestellung = await getBestellungByBestellungId(bestellung_id);
    if (!bestellung) {
        throw new Error(`Es existiert keine Bestellung mit id '${bestellung_id}'`);
    }
    if (bestellung.status !== BestellStatus.IN_PROGRESS) {
        throw new Error('Die Bestellung ist nicht in progress');
    }
    await completeBestellungByBestellungId(bestellung_id);
}

export default bestellungRouter;