const   axios = require('axios'),
        config = require('./config'),
        parseString = require('xml2js').parseString;


// DB
const knex = require('knex')({
    client: 'postgres',
    connection: {
        host     : config.HOST,
        user     : config.USER,
        password : config.PASS,
        database : config.DB,
        charset  : config.CHARSET
    }
});
// then connect bookshelf with knex
const bookshelf = require('bookshelf')(knex);


/* ==================== */
/* MODELS               */
/* ==================== */

// Games model
const Game = bookshelf.Model.extend({
    tableName: 'games'
});

// Users model
// const User = bookshelf.Model.extend({
//     tableName: 'users'
// });


// TODOS:

// 1- Function that checks ID's from $minRange to $maxRange in the current DB
        // - Add any IDs not found into a 'toCheck' array
        // - Add any IDs found to a 'toUpdate' array
// 2- Function that hits boardGameGeek API /things endpoint
        // - If it's a boardgame create a object with all the desired data
        // - Increase counter
        // - Save that object in a 'toUpdate' array 
        // - must be a timed/await function to not trigger BGG rate limiting
// 3- Function that saves the array of 'toUpdate' objects to the local DB
        // - increase savedCounter[]


// The low end of the range we will be searching
const minRange = process.argv[2];

// The high end of the range we will be searching
const maxRange = process.argv[3];

// The array to hold all ID's not found in local DB
const toCheck = [];

// The array to hold any ID's found in local DB
const toUpdate = [];

// Counters
let checkCounter = 0;
let updateCounter = 0;
let savedCounter = 0;


function checkCurrentDB(min, max, callback) {

    // loop through the IDs provided in the process.argv
    for (let i = min; i <= max; i++) {

        new Game({ 'game_id': `${i}` })
            .fetch()
            .then(result => {

                // ID not found in the DB
                if (result === null) {

                    // push the ID to the 'toScrape' array
                    toCheck.push(Number(i));
                    // increase the counter
                    checkCounter += 1;
                    // return the current index
                    return i;
                }

                // ID found in the DB
                else {

                    // push the ID to the 'toUpdate' array
                    toUpdate.push(Number(i));
                    // increase the counter
                    updateCounter += 1;
                    // return the current index
                    return i;
                }

            })

            .then(currentIndex => {

                // If i === max it's the last ID we are looking through
                // so we can stop the process here
                if (currentIndex == max) {

                    // print out which games are to be scraped
                    console.log(`\n There are ${checkCounter} games to check.`);
                    console.log(`\n There are ${updateCounter} games to update.`);

                    // hit the callback
                    return callback();
                }

            })

            .catch(error => {

                // Log any errors with this function
                console.log('Checking local DB error:', error);
            })

    } // end for loop

}


function getDataAndSave(id) {

    // Hit the BGG API (with stats turned on)
    axios.get('https://www.boardgamegeek.com/xmlapi2/thing?id=' + id + '&stats=1')
    
         .then(result => {

            // Save data/xml from BGG into a variable
            let xml = result.data;

            // new Game object
            let gameObject = {};

            parseString(xml, function(err, result) {

                if (err) {
                    throw err;
                }

                // First make sure something exists at this ID
                if (result.items.item === undefined) {
                    console.log(`${id} does not exist`);
                    return;
                }

                // Then make sure item we are parsing is a BoardGame
                if (result.items.item[0].$.type !== "boardgame") {
                    console.log(`${id} is not a boardgame.`);
                    return;
                }

                // Otherwise save the main game object into a variable
                gameObject = result.items.item[0];

            }) // end parseString()

            // BGG doesn't send age, and sends mechanics/categories as individual items
            // Need to set those as variables here

            // Game age
            // Check if year published is greater than 0
            // If it is calculate the age, if not set age to 0
            let gameAge = gameObject.yearpublished[0].$.value > 0 ? (new Date().getFullYear() - gameObject.yearpublished[0].$.value) : 0;

            // Mechanics and categories
            let gameCategories = '';
            let gameMechanics = '';

            // Loop through the categories and mechanics
            for (let i = 0; i < gameObject.link.length; i++) {
                
                // If it's a category
                // Save to category string in game object
                if (gameObject.link[i].$.type === "boardgamecategory") {
                    gameCategories += gameObject.link[i].$.value + ', ';

                // If it's a mechanic
                // Save to mechanic string in game object
                } else if (gameObject.link[i].$.type === "boardgamemechanic") {
                    gameMechanics += gameObject.link[i].$.value + ', ';
                }

            }

                
            // console.log(JSON.stringify(result));
            // console.log(gameObject.statistics[0].ratings[0].average[0].$.value);

            // Create an object for new game and save to DB
            let gameToSave = new Game ({
                rank: Number(gameObject.statistics[0].ratings[0].ranks[0].rank[0].$.value) || 0,
                bgg_link: 'https://www.boardgamegeek.com/boardgame/' + id + '/',
                game_id: id,
                names: gameObject.name[0].$.value,
                image_url: gameObject.image[0] || '',
                min_players: Number(gameObject.minplayers[0].$.value) || 1,
                max_players: Number(gameObject.maxplayers[0].$.value) || 1,
                min_time: Number(gameObject.minplaytime[0].$.value) || 1,
                max_time: Number(gameObject.maxplaytime[0].$.value) || 1,
                avg_time: Number(gameObject.playingtime[0].$.value) || 1,
                year: Number(gameObject.yearpublished[0].$.value),
                age: gameAge || 0,
                mechanic: gameMechanics,
                category: gameCategories,
                avg_rating: Number(gameObject.statistics[0].ratings[0].average[0].$.value) || 0,
                geek_rating: Number(gameObject.statistics[0].ratings[0].bayesaverage[0].$.value) || 0,
                num_votes: Number(gameObject.statistics[0].ratings[0].usersrated[0].$.value) || 0,
            });

            
            // Save the game we just got from BGG into the DB
            return gameToSave.save(null, {method: 'insert'});

         })

         .then(savedGame => {
            
            // increase the saved games counter
            savedCounter += 1;

            // log the output
            console.log(`${savedGame.attributes.names} was saved.`);

         })

         .catch(error => {

            // log any errors
            console.log('getDataAndSave ERROR:', error);

         })

}




checkCurrentDB(minRange, maxRange, () => {
    
    (function theLoop(i) {
        setTimeout(function() {
            getDataAndSave(toCheck[i]);
            // console.log('Hi');
            if (--i) { theLoop(i) } else { process.exit(); }
        }, 2000)
    })(toCheck.length)

});




// let newGame = new Game ({ 
    // rank: 198274,
    // bgg_link: 'https://www.boardgamegeek.com/boardgame/10000000/',
    // game_id: 989898,
    // names: 'Test game 3',
    // min_players: 1,
    // max_players: 99,
    // avg_time: 50,
    // min_time: 1,
    // max_time: 99,
    // year: 2019,
    // avg_rating: 7.21,
    // geek_rating: 9.8,
    // num_votes: 29087,
    // image_url: '',
    // age: 0,
    // mechanic: 'Foo',
    // category: 'Bar',
//  });