import express from 'express';
import { auth, authUser, Role, validateRole } from './auth_router.js';
import cookieParser from 'cookie-parser';
import Bestellung from './database/model/bestellungModel.js';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';
import jwt from 'jsonwebtoken';
import { completeBestellungByBestellungId, createObject, deleteBestellungByBestellungId, getAdminUUIDs, getAllBestellungen, getBestellungByBestellungId, getBestellungenByUsername, getCocktailByName, getUserByBestellungId, getUserByUsername, getUserByUUID } from './database/queries.js';

const BestellStatus = {
    IN_PROGRESS: 'IN_PROGRESS',
    FINISHED: 'FINISHED',
}

const bestellungRouter = express.Router();
bestellungRouter.use(cookieParser());
bestellungRouter.use(express.urlencoded({ extended: true }));
bestellungRouter.use(bodyParser.json());
bestellungRouter.use(redirect);

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

bestellungRouter.get('/bestellung', auth, async (req, res) => {
    const bestellungenDB = await getAllBestellungen();
    const bestellungen = bestellungenDB.map(b => {
        const timeString = dateFormat.format(new Date(b.timestamp)).replace(',', '');
        return {
            time: timeString,
            username: b.username,
            cocktail_name: b.cocktail_name,
            status: b.status,
            id: b.id
        }
    });
    const config = {
        username: req.user.username,
        role: req.user.role,
    };
    res.render('bestellungen', { bestellungen, config })
});

bestellungRouter.get(
    '/bestellungen',
    authUser,
    async (req, res) => {
        let bestellungenDB;
        if (req.user?.role === Role.USER) {
            bestellungenDB = await getBestellungenByUsername(req.user.username);
        } else if (req.user?.role === Role.ADMIN) {
            bestellungenDB = await getAllBestellungen();
        }
        let bestellungen;
        if (bestellungenDB !== undefined) {
            bestellungen = bestellungenDB.map(b => {
                const timeString = dateFormat.format(new Date(b.timestamp)).replace(',', '');
                return {
                    time: timeString,
                    username: b.username,
                    cocktail_name: b.cocktail_name,
                    status: b.status,
                    id: b.id
                }
            });
        }
        res.json(bestellungen);
    });

const bestellungSession = [];
function registerBestellungClient(user, ws) {
    bestellungSession.push({
        user: user,
        ws: ws
    });
    ws.on('close', () => {
        bestellungSession.splice(bestellungSession.findIndex(session => session.user.uuid === user.uuid), 1);
    });
    console.log('👤 A user connected to Bestellung. Total:', bestellungSession.length);
}
function getUserIdFromRequest(req) {
    const token = req.cookies.token;
    return token ? jwt.verify(token, process.env.PASSWORD_HASH_SECRET).id : null;
}
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
                time: timeString,
                username: b.username,
                cocktail_name: b.cocktail_name,
                status: b.status,
                id: b.id
            }
        });
    }
    return bestellungen;
}

export const mountBestellungRouter = () => {
    bestellungRouter.ws('/bestellung/ws', async (ws, req) => {
        const uuid = getUserIdFromRequest(req);
        const user = await getUserByUUID(uuid);
        if (!user) {
            ws.close();
            return;
        }
        console.log('WebSocket connection established');
        registerBestellungClient(user, ws);
        const bestellungen = await findBestellungenByUser(user);
        ws.send(JSON.stringify(bestellungen));
    });
};

async function sendBestellungUpdateToClients(user) {
    const adminUsers = await getAdminUUIDs();
    const notifyUsers = [...adminUsers, user];
    for (const session of bestellungSession) {
        for (const user of notifyUsers) {
            if (user.uuid === session.user.uuid) {
                const bestellungen = await findBestellungenByUser(user);
                session.ws.send(JSON.stringify(bestellungen));
            }
        }
    }
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

export default bestellungRouter;