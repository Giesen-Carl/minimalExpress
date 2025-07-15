import express from 'express';
import { auth, Role, validateRole } from './auth_router.js';
import Cocktail from './database/model/cocktailModel.js';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { redirect } from './auth_router.js';
import { createObject, getAllIngredients, getCocktailByName } from './database/queries.js';

const cocktailRouter = express.Router();
cocktailRouter.use(cookieParser());
cocktailRouter.use(express.urlencoded({ extended: true }));
cocktailRouter.use(bodyParser.json());
cocktailRouter.use(redirect);

cocktailRouter.route('/cocktails')
    .get(auth, validateRole(Role.ADMIN), async (req, res) => {
        const ingredients = (await getAllIngredients()).map(ing => ing.ingredient_name);
        const data = {
            ingredients: ingredients,
        }
        res.render('createCocktail.ejs', data);
    })
    .post(auth, validateRole('ADMIN'), async (req, res) => {
        const body = req.body;
        try {
            const cocktail = await getCocktailByName(body.cocktail_name);
            if (cocktail) {
                throw new Error('Es existiert bereits ein Cocktail mit diesem Namen.')
            }
            const ingredients = JSON.parse(body.ingredients || '[]');
            if (ingredients.length === 0) {
                throw new Error('Es muss mindestens eine Zutat angegeben werden.');
            }
            for (const ingredient of ingredients) {
                if (!ingredient.ingredient) {
                    throw new Error('Alle Zutaten müssen einen Namen haben.');
                }
            }
            const db_ingredients = await getAllIngredients();
            for (const ingredient of ingredients) {
                if (!db_ingredients.map(ing => ing.ingredient_name).includes(ingredient.ingredient)) {
                    throw new Error(`Die Zutat "${ingredient.ingredient}" existiert nicht.`);
                }
            }
            await createObject('cocktail', {
                cocktail_name: body.cocktail_name,
                category: body.category,
                price: body.price,
            });
            const cocktail_id = (await getCocktailByName(body.cocktail_name)).id;
            for (const ingredient of ingredients) {
                const ingredient_id = db_ingredients.find(db_ing => db_ing.ingredient_name === ingredient.ingredient).id;
                await createObject('cocktail_ingredient', {
                    cocktail_id: cocktail_id,
                    ingredient_id: ingredient_id,
                    menge: ingredient.menge,
                });
            }
            res.redirect('/');
        } catch (error) {
            const selectedIngredients = JSON.parse(body.ingredients || '[]').map(ing => ing.ingredient);
            const all_ingredients = (await getAllIngredients()).map(ing => ing.ingredient_name);
            const ingredients = [];
            for (const ing of all_ingredients) {
                if (!selectedIngredients.includes(ing)) {
                    ingredients.push(ing);
                }
            }
            const data = {
                cocktail_name: body.cocktail_name,
                category: body.category,
                price: body.price,
                selected_ingredients: body.ingredients,
                ingredients: ingredients,
                error: error.message
            };
            res.render('createCocktail.ejs', data);
        }
    });

cocktailRouter.post('/cocktails/delete/:cocktail_name', async (req, res) => {
    const paramName = req.params.cocktail_name;
    try {
        const cocktail = await Cocktail.findOne({ where: { cocktail_name: paramName } })
        await cocktail.destroy();
    } catch (e) {
        console.log(e);
    }
    res.redirect('/')
});

export default cocktailRouter;