import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';
import jwt from 'jsonwebtoken';
import { getAdminUUIDs, getUserByUUID } from './database/queries.js';

class WebsocketManager {
    static mountingList = [];
    static mount = () => WebsocketManager.mountingList.forEach(f => f());
    sessions = [];
    constructor(router, subpath, dataSend) {
        router.use(cookieParser());
        router.use(express.urlencoded({ extended: true }));
        router.use(bodyParser.json());
        router.use(redirect);
        this.dataSend = dataSend;
        WebsocketManager.mountingList.push(() => {
            router.ws(`${subpath}/ws`, async (ws, req) => {
                const token = req.cookies.token;
                const uuid = token ? jwt.verify(token, process.env.PASSWORD_HASH_SECRET).id : null;
                const user = await getUserByUUID(uuid);
                if (!user) {
                    ws.close();
                    return;
                }
                this.sessions.push({ user: user, ws: ws });
                ws.on('close', () => this.sessions.splice(this.sessions.findIndex(session => session.user.uuid === user.uuid), 1)[0].user);
                ws.send(await this.dataSend(user));
            });
        });
    }

    sendUpdateToClients = async (notifyUsers) => {
        for (const session of this.sessions) {
            for (const notifyUser of notifyUsers) {
                if (notifyUser.uuid === session.user.uuid) {
                    session.ws.send(await this.dataSend(session.user));
                }
            }
        }
    }
}

export default WebsocketManager;