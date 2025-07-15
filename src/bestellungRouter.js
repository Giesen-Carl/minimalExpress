import express from 'express';
import { auth, authUser, Role, validateRole } from './auth_router.js';
import { completeBestellungByBestellungId, createObject, deleteBestellungByBestellungId, getAdminUUIDs, getAllBestellungen, getBestellungByBestellungId, getBestellungenByUsername, getCocktailByName, getUserByBestellungId, getUserByUsername, getUserByUUID } from './database/queries.js';
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
    const bestellungenDB = await getAllBestellungen();
    const bestellungen = bestellungenDB.map(b => {
        const timeString = dateFormat.format(new Date(b.timestamp)).replace(',', '');
        return {
            timestamp: b.timestamp,
            time: timeString,
            username: b.username,
            cocktail_name: b.cocktail_name,
            status: b.status,
            id: b.id
        }
    })
        .sort((a, b) => getTimeFromTimestamp(a.timestamp) - getTimeFromTimestamp(b.timestamp));
    const config = {
        username: req.user.username,
        role: req.user.role,
    };
    res.render('bestellungen', { bestellungen, config })
});

async function findBestellungenByUser(user) {
    let bestellungenDB;
    if (user.role === Role.USER) {
        bestellungenDB = await getBestellungenByUsername(user.username);
    } else if (user.role === Role.ADMIN) {
        bestellungenDB = await getAllBestellungen();
    }
    let bestellungen;
    if (bestellungenDB !== undefined) {
        bestellungen = bestellungenDB.map(b => {
            const timeString = dateFormat.format(new Date(b.timestamp)).replace(',', '');
            return {
                timestamp: b.timestamp,
                time: timeString,
                username: b.username,
                cocktail_name: b.cocktail_name,
                status: b.status,
                id: b.id
            }
        })
            .sort((a, b) => getTimeFromTimestamp(a.timestamp) - getTimeFromTimestamp(b.timestamp));
    }
    return bestellungen;
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
bestellungRouter.post(
    '/bestellung/delete/:bestellung_id',
    authUser,
    validateRole(Role.ADMIN),
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

function getTimeFromTimestamp(timestamp) {
    return (new Date(timestamp)).getTime();
}

export default bestellungRouter;