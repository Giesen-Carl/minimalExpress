import express from 'express';
import { auth, Role, validateRole } from './auth_router.js';
import { createObject, deleteIngredientById, getAdminUUIDs, getAllIngredients, setIngredientAvailability } from './database/queries.js';
import WebsocketManager from './websockerManager.js';

const ingredientRouter = express.Router();
const dataSend = async () => {
    const ingredients = await getAllIngredients();
    return JSON.stringify(ingredients);
}
const wm = new WebsocketManager(ingredientRouter, '/ingredient', dataSend);

ingredientRouter.get('/ingredient', auth, validateRole(Role.ADMIN), async (req, res) => {
    const config = {
        username: req.user.username,
        role: req.user.role,
    };
    res.render('ingredient.ejs', { config });
})

async function sendUpdate() {
    const adminUUIDs = await getAdminUUIDs();
    await wm.sendUpdateToClients(adminUUIDs);
}

ingredientRouter.post('/ingredient/create', auth, validateRole(Role.ADMIN), async (req, res) => {
    await createObject('ingredient', {
        ingredient_name: req.body.ingredient_name,
        available: true,
    });
    await sendUpdate();
});
ingredientRouter.post('/ingredient/availability', auth, validateRole(Role.ADMIN), async (req, res) => {
    await setIngredientAvailability(req.body.ingredient_id, req.body.availability);
    await sendUpdate();
});
ingredientRouter.post('/ingredient/delete', auth, validateRole(Role.ADMIN), async (req, res) => {
    await deleteIngredientById(req.body.ingredient_id);
    await sendUpdate();
});

export default ingredientRouter;