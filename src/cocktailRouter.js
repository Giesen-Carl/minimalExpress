import express from 'express';
import { auth, authUser, Role, validateRole } from './auth_router.js';
import { createObject, deleteCocktailById, deleteCocktailIngredientByCocktailId, getAllCocktailsWithIngredients, getAllIngredients, getCocktailByName } from './database/queries.js';
import WebsocketManager from './websockerManager.js';

const cocktailRouter = express.Router();
const dataSend = async () => {
    const cocktails = await getAllCocktailsWithIngredients();
    const categories = [...new Set(cocktails.map(elem => elem.category))];
    const data = categories.map(category_name => {
        return {
            category_name: category_name,
            category_cocktails: cocktails.filter(elem => elem.category === category_name && elem.available === true)
        }
    })
    return JSON.stringify(data);
}
const wm = new WebsocketManager(cocktailRouter, '/cocktails', dataSend);

cocktailRouter.get('/', authUser, async (req, res) => {
    const config = {
        username: req.user?.username,
        role: req.user?.role,
    }
    res.render('cocktails', { config: config });
});

async function sendUpdate() {
    // const cocktails = await getAllCocktailsWithIngredients();
    // const categories = [...new Set(cocktails.map(elem => elem.category))];
    // const data = categories.map(categoryName => {
    //     return {
    //         name: categoryName,
    //         items: cocktails.filter(elem => elem.category === categoryName && elem.available === true)
    //     }
    // })
}

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
        const cocktail_id = (await getCocktailByName(paramName)).id;
        if (!cocktail_id) {
            throw new Error('Cocktail not found');
        }
        await deleteCocktailById(cocktail_id);
        await deleteCocktailIngredientByCocktailId(cocktail_id);
    } catch (e) {
        console.log(e);
    }
    res.redirect('/')
});

export default cocktailRouter;