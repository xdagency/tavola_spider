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

                // First make sure item we are parsing is a BoardGame
                if (result.items.item[0].$.type !== "boardgame") {
                    console.log("This is not a boardgame!");
                    return;
                }


                // Game
                game = {
                    name: result.items.item[0].name[0].$.value,
                    image: result.items.item[0].image[0],
                    bgg_link: 'https://www.boardgamegeek.com/boardgame/' + toScrape[0] + '/',
                    game_id: toScrape[0],
                    min_players: Number(result.items.item[0].minplayers[0].$.value),
                    max_players: Number(result.items.item[0].maxplayers[0].$.value),
                    min_time: Number(result.items.item[0].minplaytime[0].$.value),
                    max_time: Number(result.items.item[0].maxplaytime[0].$.value),
                    avg_time: Number(result.items.item[0].playingtime[0].$.value),
                    year: Number(result.items.item[0].yearpublished[0].$.value),
                    age: 0,
                    mechanic: '',
                    category: '',
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
            console.log(game);

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