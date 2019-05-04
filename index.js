const   express = require('express'),
        app = express(),
        axios = require('axios');


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

checkCurrentDB(minRange, maxRange, () => {
    process.exit();
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