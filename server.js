'use strict'

//PROXY SERVER - API server

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();

const PORT = process.env.PORT;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));
const app = express();

app.use(cors());

app.listen(PORT, () => {
  console.log(`app is running on ${PORT}`)
});


//handles error if the data we don't want is returned
function handleError(err, res){
  console.error(`ERR`, err);
  if(res){res.status(500).send(`sorry no peanuts`);}
}



app.get('/location', getLocation);
app.get('/weather', getWeatherData);
app.get('/yelp', getYelpData);
app.get('/movies', getMovieData);
app.get('/meetups', getMeetupData);
//app.get('/trails', getTrailData);


//constructor function for data to normalize data from maps api
function Location(query, data){
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

Location.prototype.save = function() {
  let SQL = `
    INSERT INTO locations
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
  `;
  //this creates an array of the values in the Location Instance
  let values = Object.values(this);
  client.query(SQL,values);
};

Location.fetchLocation = (query)=>{
  const URL = (`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`);
  return superagent.get(URL)
    .then( data =>{
      console.log('got location data from api');
      if ( ! data.body.results.length){
        throw 'no data';
      }
      else {
        let location = new Location(query, data.body.results[0]);
        location.save();
        return location;
      }
    })
    .catch(error => handleError(error));
};

//function to create object locationHandler and sends database info if results exit in database, if no results calls fetchLocation
function getLocation (request, response){
  const locationHandler = {
    query: request.query.data,
    cacheHit: (results) =>{
      console.log('got location data from sql');

      //not sure what the .row[0] do, why can't we use results[0]
      response.send(results.rows[0]);
    },
    cacheMiss: ()=>{
      //create the table before the location data is rendered so that is always being shown from the table (with an id that weather can use)
      Location.fetchLocation(request.query.data)
        .then(()=>{
          const SQL = `SELECT * FROM locations WHERE search_query = $1`;
          client.query(SQL, [request.query.data])
            .then(data=>response.send(data.rows[0]))
            .catch(error => handleError(error));
        }).catch(error => handleError (error));
    },

  };
  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = (queryDataHandler) =>{
  const SQL = `SELECT * FROM locations WHERE search_query = $1`;
  const values = [queryDataHandler.query];

  return client.query( SQL, values)
    .then( results => {
      if ( results.rowCount > 0){
        queryDataHandler.cacheHit(results);
      }
      else {
        queryDataHandler.cacheMiss();
      }
    })
    .catch(console.error);
};

//--------------------Weather Functions ----------------- //

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}

//Prototype function that inserts new data into the SQL table;
Weather.prototype.save = function(id){
  const SQL = `INSERT INTO weathers(forecast,time,created_at,location_id) VALUES($1,$2,$3,$4);`;
  const values = Object.values(this);
  values.push(Date.now());
  values.push(id);
  client.query(SQL, values);
}

Weather.deleteEntryById = function (id) {
  const SQL = `DELETE * FROM weathers WHERE location_id = ${id};`;
  client.query(SQL)
    .then(() => {
      console.log(`DELETED weather entry from SQL`)
    })
    .catch(error => handleError(error));
}

Weather.lookup = function(queryDataHandler) {
  const SQL = `SELECT * FROM weathers WHERE location_id = $1;`;
  console.log(queryDataHandler.location.id + ' is the data handler location');
  client.query(SQL, [queryDataHandler.location.id]) //why is it wrapped in brackets
    .then(results => {
      if(results.rowCount > 0){
        console.log('weather data exists in SQL');

        let currentAge = Date.now()- results.rows[0].created_at /(1000 * 1);
        if(results.rowCount > 0 && currentAge > 1 ){
          console.log(`weather Data was too old`);
          Weather.deleteEntryById(queryDataHandler.location.id);
          queryDataHandler.cacheMiss();
        }
        else {
          console.log(`weather data was just right `);
          queryDataHandler.cacheHit(results);
        }
      }
      else {
        console.log('got weather data from API');
        queryDataHandler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Weather.fetch = function(location) {
  const URL = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${location.latitude},${location.longitude}`;
  return superagent
    .get(URL)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    }).catch(handleError);

};

function getWeatherData(request, response) {
  const queryDataHandler = {
    location: request.query.data,
    cacheHit: function(result) {
      response.send(result.rows)
    },
    cacheMiss: function() {
      Weather.fetch(request.query.data)
        .then(results => {response.send(results)})
        .catch(console.error);
    },
  };
  Weather.lookup(queryDataHandler);
}

//--------------------Yelp Data-----------------


//constructor function for data to normalize data from yelp api
function Yelp(data){
  this.eatery_name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

Yelp.prototype.save = function(id){
  const SQL = `INSERT INTO yelps(eatery_name,image_url,price,rating,yelp_url,created_at,location_id) VALUES($1,$2,$3,$4,$5,$6,$7);`;
  const values = Object.values(this);
  values.push(Date.now());
  values.push(id);
  client.query(SQL, values);
}


Yelp.deleteEntryById = function (id) {
  const SQL = `DELETE FROM yelps WHERE location_id = ${id};`;
  client.query(SQL)
    .then(() => {
      console.log(`DELECTED yelp entry from SQL`)
    })
    .catch(error => handleError(error));
}


Yelp.lookup = function(queryDataHandler){
  const SQL = `SELECT * FROM yelps WHERE location_id = $1;`;
  client.query(SQL, [queryDataHandler.location.id])
    .then(results => {

      if(results.rowCount > 0){
        console.log('yelp data existed is sql');
        let currentAge = Date.now() - results.rows[0].created_at / (1000 * 60);

        if(results.rowCount > 0 && currentAge > 1){
          console.log('yelp data was too old');
          Yelp.deleteEntryById(queryDataHandler.location.id);
          queryDataHandler.cacheMiss();
        }
        else {
          console.log('yelp Data was just right')
        }

      }
      else {
        console.log('got yelp data from API');
        queryDataHandler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Yelp.fetch = function(location) {
  const URL = `https://api.yelp.com/v3/businesses/search?latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent
    .get(URL)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then( result =>{
      console.log('yelp result' + result);
      const yelpArray = result.body.businesses.map(business =>{
        const eatery = new Yelp(business);
        eatery.save(location.id);
        return eatery;
      });
      return yelpArray;
    })
    .catch(error => handleError(error));
};

function getYelpData(request, response) {
  console.log('inside of get yelp data');

  const queryDataHandler = {
    location: request.query.data,
    cacheHit: function(result){
      response.send(result.rows)
    },
    cacheMiss: function() {
      Yelp.fetch(request.query.data)
        .then(results => {response.send(results)})
        .catch(handleError);
    },
  };
  Yelp.lookup(queryDataHandler);
}


//----------------Movie Functions -------------

//constructor function for data to normalize data from Movie api
function Movie(data){
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.popularity = data.popularity;
  this.released_on = data.released_on;
  this.image_url = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
}

Movie.prototype.save = function(id){
  const SQL = `INSERT INTO movies(title,overview,average_votes,total_votes,popularity,released_on,image_url,created_at,location_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8);`;
  const values = Object.values(this);
  values.push(Date.now());
  values.push(id);
  client.query(SQL, values);
}

Movie.deleteEntryById = function(id){
  const SQL = `DELECTED FROM movies WHERE location_id = ${id};`;
  client.query(SQL)
    .then(()=>{
      console.log('dected movie data from sql');
    }
    ).catch(error => handleError(error));
}

Movie.lookup = function(queryDataHandler){
  const SQL = `SELECT * FROM movies WHERE location_id = $1;`;
  client.query(SQL, [queryDataHandler.location.id])
    .then(results => {
      if(results.rowCount>0){
        console.log('movie data existed in sql');

        let currentAge = Date.now() - results.rows[0].created_at / (1000);

        if(results.roCount > 0 && currentAge > 1){
          console.log('movie data was too old');
          Movie.deleteEntryById(queryDataHandler.location.id);
          queryDataHandler.cacheMiss();
        }
        else {
          console.log('data was just right');
          queryDataHandler.cacheHit(results);
        }
      }
      else{
        console.log('got movie data from API');
        queryDataHandler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

Movie.fetch = function(location) {
  const city = location.formatted_query.split(',')[0];
  const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${city}&page=1&include_adult=false`;
  return superagent
    .get(URL)
    .then(results =>{
      const movieArray = results.body.results.map( movies =>{
        const film = new Movie(movies);
        film.save(location.id);
        return film;
      });
      return movieArray;
    })
    .catch(error => handleError(error));
};

function getMovieData(request, response){
  const queryDataHandler = {
    location: request.query.data,
    cacheHit: function(result){
      response.send(result.rows)
    },
    cacheMiss: function() {
      Movie.fetch(request.query.data)
        .then(results => {response.send(results)})
        .catch(handleError);
    },
  };
  Movie.lookup(queryDataHandler);
}



//----------------MeetUP Functions -------------

//constructor function for data to normalize data from MeetUP api
function Meetup(data){
  this.link = data.link;
  this.name = data.name;
  this.creation_date = data.created;
  this.host = data.group.name;
}

Meetup.prototype.save = function(id){
  const SQL = `INSERT INTO meetups(link,mu_name,creation_date,host,created_at,location_id) VALUES($1,$2,$3,$4,$5,$6);`;
  const values = Object.values(this);
  values.push(Date.now());
  values.push(id);
  client.query(SQL, values);
}

Meetup.deleteEntryById = function(id){
  const SQL = `DELECTED FROM meetups WHERE location_id = ${id};`;
  client.query(SQL)
    .then(()=>{
      console.log('dected meetup data from sql');
    }
    ).catch(error => handleError(error));
}

Meetup.lookup = function(queryDataHandler){
  const SQL = `SELECT * FROM meetups WHERE location_id = $1;`;
  client.query(SQL, [queryDataHandler.location.id])
    .then(results => {
      if(results.rowCount>0){
        console.log('meetups data existed in sql');

        let currentAge = Date.now() - results.rows[0].created_at / (1000);

        if(results.roCount > 0 && currentAge > 1){
          console.log('meetups data was too old');
          Movie.deleteEntryById(queryDataHandler.location.id);
          queryDataHandler.cacheMiss();
        }
        else {
          console.log('meetups data was just right');
          queryDataHandler.cacheHit(results);
        }
      }
      else{
        console.log('got meetup data from API');
        queryDataHandler.cacheMiss();
      }
    }).catch(error => handleError(error));
};

Meetup.fetch = function(location) {
  const URL = `https://api.meetup.com/find/upcoming_events?key=${process.env.MEET_API_KEY}&lat=${location.latitude}&lon=${location.longitude}`;
  return superagent
    .get(URL)
    .then(results =>{
      console.log('meetup results' + results);
      const meetupArray = results.body.events.map( event =>{
        const groupEvent = new Meetup(event);
        groupEvent.save(location.id);
        return groupEvent;
      });
      return meetupArray;
    }).catch(error => handleError(error));
};

function getMeetupData(request, response){
  const queryDataHandler = {
    location: request.query.data,
    cacheHit: function(result){
      response.send(result.rows)
    },
    cacheMiss: function() {
      Meetup.fetch(request.query.data)
        .then(results => {response.send(results)})
        .catch(handleError);
    },
  };
  Meetup.lookup(queryDataHandler);
}



