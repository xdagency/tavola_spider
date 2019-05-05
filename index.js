const   express = require('express'),
        app = express(),
        axios = require('axios'),
        parseString = require('xml2js').parseString;


// DB
const knex = require('knex')({
    client: 'postgres',
    connection: {
        host     : '127.0.0.1',
        user     : 'postgres',
        password : 'postgres',
        database : 'boardgamegen',
        charset  : 'utf8'
    }
});
// then connect bookshelf with knex
const bookshelf = require('bookshelf')(knex);

// Variables
const PORT = process.env.PORT || 8181;

// headers to fix CORS issues
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

/* ==================== */
/* MODELS               */
/* ==================== */

// Games model
const Game = bookshelf.Model.extend({
    tableName: 'games'
});


// TODOS:
// Build a function that takes in a range of IDs
    // Use process.argv arguments
// First check each ID against the current Database
// If it exists, do nothing
// If it doesn't exist hit the BGG API and grab the XML
    // Make sure to spread out the requests to API (setTimeout?)
// Extract the needed data and save to my DB
// Count every time a game was added to DB
    // Console log how many items were added to DB


// Counter
let counter = 0;

// The low end of the range we will be searching
const minRange = process.argv[2];
// The high end of the range we will be searching
const maxRange = process.argv[3];
//console.log('Search from', minRange, 'to', maxRange);

// The array to hold any ID's not found in local DB
const toScrape = [];


function checkCurrentDB(min, max, callback) {

    // loop through the IDs provided in the process arguments
    for (let i = min; i <= max; i++) {

        new Game({ 'game_id': `${i}` })
            .fetch()
            .then(result => {

                // If can't find in local DB push to our toScrape array
                if (result === null) {
                    toScrape.push(Number(i));
                }

                // Otherwise do nothing

            })
            .then(results => {

                // If i === max it's the last ID we are looking through
                // so we can stop the process here
                if (i == max) {
                    console.log('To Scrape:', toScrape);
                    return callback();
                }

            })
            .catch(error => {
                console.log('Checking local DB error:', error);
            })

    }

}


function bgg(id, callback) {

    // Hit the BGG API
    axios.get('https://www.boardgamegeek.com/xmlapi2/thing?id=' + toScrape[0] + '&stats=1')
    
         .then(result => {

            // Initialize parser
            // let parser = new DOMParser();
            // Save data/xml from BGG into a variable
            let xml = result.data;
            
            // Empty object to save xml data to
            let game = {}

            parseString(xml, function(err, result) {

                // First make sure something exists at this ID
                if (result.items.item === undefined) {
                    console.log("Nothing at this ID.")
                    return;
                }

                // Otherwise save the main game object into a variable
                let gameObject = result.items.item[0];

                // Then make sure item we are parsing is a BoardGame
                if (gameObject.$.type !== "boardgame") {
                    console.log("This is not a boardgame.");
                    return;
                }
                
                // console.log(JSON.stringify(result));
                // console.log(gameObject.statistics[0].ratings[0].average[0].$.value);

                // Game
                game = {
                    name: gameObject.name[0].$.value,
                    image: gameObject.image[0],
                    bgg_link: 'https://www.boardgamegeek.com/boardgame/' + toScrape[0] + '/',
                    game_id: toScrape[0],
                    min_players: Number(gameObject.minplayers[0].$.value) || 1,
                    max_players: Number(gameObject.maxplayers[0].$.value) || 1,
                    min_time: Number(gameObject.minplaytime[0].$.value) || 1,
                    max_time: Number(gameObject.maxplaytime[0].$.value) || 1,
                    avg_time: Number(gameObject.playingtime[0].$.value) || 1,
                    year: Number(gameObject.yearpublished[0].$.value),
                    age: 0,
                    mechanic: '',
                    category: '',
                    avg_rating: Number(gameObject.statistics[0].ratings[0].average[0].$.value) || 0,
                    geek_rating: Number(gameObject.statistics[0].ratings[0].bayesaverage[0].$.value) || 0,
                    num_votes: Number(gameObject.statistics[0].ratings[0].usersrated[0].$.value) || 0,
                }


                // Game age
                // Check if year published is greater than 0
                // If it is calculate the age, if not set age to 0
                game.age = result.items.item[0].yearpublished[0].$.value > 0 ? (new Date().getFullYear() - result.items.item[0].yearpublished[0].$.value) : 0;


                // Mechanics and categories
                let mechanicsAndCategories = result.items.item[0].link;

                // Loop through the categories and mechanics
                for (let i = 0; i < mechanicsAndCategories.length; i++) {
                    
                    // If it's a category
                    // Save to category string in game object
                    if (mechanicsAndCategories[i].$.type === "boardgamecategory") {
                        game.category += mechanicsAndCategories[i].$.value + ', ';

                    // If it's a mechanic
                    // Save to mechanic string in game object
                    } else if (mechanicsAndCategories[i].$.type === "boardgamemechanic") {
                        game.mechanic += mechanicsAndCategories[i].$.value + ', ';
                    }

                }


            })
            
            // See what our object looks like
            // console.log(game);

         })

         .then(result => {
            
            // After all the data from BGG is grabbed, hit the callback function
            return callback();
         })

         .catch(error => {
             console.log('Hit BGG API Error:', error);
         })

}


checkCurrentDB(minRange, maxRange, () => {
    bgg(1, () => {
        process.exit();
    })
});

// axios.get('https://www.boardgamegeek.com/xmlapi2/thing?id=' + process.argv[2])
//      .then(result => {
//         // console.log(result.data);
//         console.log('got data');
//      })
//      .then(result => {
//          process.exit();
//      })
//      .catch(error => {
//         console.log('axios GET error:', error);
//      })


/* ==================== */
/* LISTEN               */
/* ==================== */

app.listen(PORT, () => {
    console.log('We are up on', PORT);
})