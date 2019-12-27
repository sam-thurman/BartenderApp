'use strict';

const express = require('express')
require('dotenv').config()
const app = express()
require('ejs')
const superagent = require('superagent')
const client = require('./lib/client')
const methodOverride = require('method-override')

const PORT = process.env.PORT || 3001;
app.use(express.static('./public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true, }));
app.use(methodOverride('_method'));
app.delete('/delete/deletecocktail', deleteCocktail);

// ROUTES
app.get('/', renderHome);
app.get('/search', searchCocktails);
app.post('/search/cocktails', getCocktailsByBase);
app.post('/view', getCocktailsByName);
app.get('/recipe-book', renderRecipeBookPage);
app.post('/recipe-book', insertIntoDatabase);
// app.post('/searches', getBookInfo);
// app.post('/', insertIntoDatabase);
// app.get('/books/:book_isbn', getOneBook);
// app.put('/books/updatebook', updateBook);
// app.delete('/delete/deletebook', deleteBook);

function renderRecipeBookPage(request, response) {
  let sql = "SELECT * FROM cocktails;";
  client.query(sql)
    .then(results => {
      let cocktails = results.rows;
      response.render('database/recipe-book', { cocktailArray: cocktails })
    })
}

function renderHome(request, response) {
  response.render('index');
}

function searchCocktails(request, response) {
  response.render('search/search');
}

function getCocktailsByBase(request, response) {
  superagent.get(`https://www.thecocktaildb.com/api/json/v1/1/filter.php?i=${request.body.search}`).then(responseFromSuper => {
    let arr = responseFromSuper.body.drinks.map(cocktail => {
      return new SearchCocktail(cocktail);
    });
    response.render('search/search-results-base', { arr: arr });
  })
}

function getCocktailsByName(request, response) {
  superagent.get(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${request.body.search}`).then(responseFromSuper => {
    let filteredResult = responseFromSuper.body.drinks;
    console.log(filteredResult[0]);
    let ingredientArray = [];
    let measureArray = [];
    for (let [K, V] of Object.entries(filteredResult[0])) {
      if (K.includes('Ingredient')) {
        ingredientArray.push(V);
      }
      if (K.includes('Measure')) {
        measureArray.push(V);
      }
    }
    let cocktail = new Cocktail(filteredResult[0], ingredientArray, measureArray);
    response.render('view', { cocktail: cocktail });
  })
}

function insertIntoDatabase(request, response) {
  console.log(request.body.id);
  console.log(request.body.title);
  console.log(request.body.image_url);
  console.log(request.body.instructions);
  console.log(request.body.ingredients);

  let sql = 'INSERT INTO cocktails (cocktail_id, title, image_url, instructions, ingredients) VALUES ($1, $2, $3, $4, $5);';
  let safeValues = [request.body.id, request.body.title, request.body.image_url, request.body.instructions, request.body.ingredients];

  client.query(sql, safeValues);

  response.redirect('/recipe-book');
}

function deleteCocktail(request, response) {
  let sql = `DELETE FROM cocktails WHERE cocktail_id = $1;`;
  let id = request.body.cocktail_id;
  let safeValues = [id];

  client.query(sql, safeValues)
    .then(() => {
      response.redirect('/recipe-book');
    })
    .catch(error => {
      handleError(error, response);
    });
}

function Cocktail(obj, ingredientArray, measureArray) {
  this.title = obj.strDrink;
  this.image_url = obj.strDrinkThumb;
  this.id = obj.idDrink;
  this.instructions = obj.strInstructions;
  let instructionRegex = /\.\w/g;
  let capLetterRegex = /\.\s[a-z]/g;
  if (instructionRegex.test(this.instructions)) {
    this.instructions = this.instructions.replace(/\./g, '. ');
    let fLeterArr = this.instructions.match(capLetterRegex);
    for (let i = 0; i < fLeterArr.length; i++) {
      this.instructions = this.instructions.replace(/\.\s[a-z]/, fLeterArr[i].toUpperCase())
    }
  }
  this.ingredients = measureArray[0] + ' ' + ingredientArray[0];
  for (let i = 1; i < ingredientArray.length; i++) {
    measureArray[i] !== null ? this.ingredients = this.ingredients + ', ' + measureArray[i] : this.ingredients;

    ingredientArray[i] !== null ? this.ingredients = this.ingredients + ' ' + ingredientArray[i] : this.ingredients;
  }
}

function SearchCocktail(obj) {
  this.name = obj.strDrink;
  this.image_url = obj.strDrinkThumb;
  this.id = obj.idDrink;
}


client.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`App is listening on port ${PORT}`));
  })
  .catch(err => console.error(err));
