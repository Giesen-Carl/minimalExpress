import express from 'express';
import { auth, Role, validateRole } from './auth_router.js';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';
import { createObject, deleteIngredientByName, getAllIngredients, setIngredientAvailability } from './database/queries.js';

const ingredientRouter = express.Router();
ingredientRouter.use(cookieParser());
ingredientRouter.use(express.urlencoded({ extended: true }));
ingredientRouter.use(bodyParser.json());
ingredientRouter.use(redirect);

ingredientRouter.get('/ingredient', auth, validateRole(Role.ADMIN), async (req, res) => {
    const ingredients = (await getAllIngredients());
    ingredients.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
    const data = {
        ingredients: ingredients.map(ingredient => ({
            name: ingredient.ingredient_name,
            availability: ingredient.available
        })),
    };
    const config = {
        username: req.user.username,
        role: req.user.role,
    };
    res.render('ingredient.ejs', { ...data, config });
})

ingredientRouter.post('/ingredient/create', auth, validateRole(Role.ADMIN), async (req, res) => {
    await createObject('ingredient', {
        ingredient_name: req.body.ingredient_name,
    });
});
ingredientRouter.post('/ingredient/availability', auth, validateRole(Role.ADMIN), async (req, res) => {
    await setIngredientAvailability(req.body.ingredient_name, req.body.availability);
});
ingredientRouter.post('/ingredient/delete', auth, validateRole(Role.ADMIN), async (req, res) => {
    await deleteIngredientByName(req.body.ingredient_name);
});

export default ingredientRouter;