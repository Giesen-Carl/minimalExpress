import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';
import jwt from 'jsonwebtoken';
import { getUserByUUID } from './database/queries.js';
import crypto from 'crypto';

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
                let user = undefined;
                try {
                    const token = req.cookies.token;
                    const uuid = token ? jwt.verify(token, process.env.PASSWORD_HASH_SECRET).id : null;
                    if (!uuid) {
                        throw new Error('No valid token provided');
                    }
                    user = await getUserByUUID(uuid);
                } catch (error) {
                    user = { username: 'Guest', role: 'GUEST', uuid: crypto.randomUUID() };
                }
                this.sessions.push({ user: user, ws: ws });
                ws.on('close', () => this.sessions.splice(this.sessions.findIndex(session => session.user.uuid === user.uuid), 1)[0].user);
                ws.send(await this.dataSend(user));
            });
        });
    }
    sendUpdateToClients = async (notifyUsers) => {
        if (notifyUsers === 'all') {
            notifyUsers = this.sessions.map(session => session.user);
        }
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