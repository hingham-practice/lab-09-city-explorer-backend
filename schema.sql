DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS yelps;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS trails;
DROP TABLE IF EXISTS locations;



CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    search_query VARCHAR(255),
    formatted_query VARCHAR(255),
    latitude NUMERIC (8, 6),
    longitude NUMERIC (9 ,6)
);

CREATE TABLE weathers (
    id SERIAL PRIMARY KEY,
    forecast VARCHAR(255),
    time VARCHAR(255),
    created_at BIGINT,
    location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABlE yelps (
    id SERIAL PRIMARY KEY,
    eatery_name VARCHAR(255),
    image_url VARCHAR(255),
    price VARCHAR(255),
    rating NUMERIC(8),
    yelp_url VARCHAR(255),
    created_at BIGINT,
    location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABlE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    overview VARCHAR(255),
    average_votes NUMERIC(8),
    total_votes NUMERIC(8),
    popularity VARCHAR(255),
    released_on VARCHAR(255),
    created_at BIGINT,
    image_url VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE meetups (
    id SERIAL PRIMARY KEY,
    link VARCHAR(255),
    mu_name VARCHAR(255),
    creation_date CHAR(15),
    host VARCHAR (255),
    created_at BIGINT,
    location_id INTEGER NOT NULL REFERENCES locations(id)
);

CREATE TABLE trails(
    id SERIAL PRIMARY KEY,
    trail_name VARCHAR (255),
    location VARCHAR (255),
    length NUMERIC (4,1),
    stars NUMERIC (2,1),
    star_votes INTEGER,
    summary VARCHAR(255),
    trail_url VARCHAR(255),
    conditions TEXT,
    condition_date CHAR(10),
    condition_time CHAR(8),
    created_at BIGINT,
    location_ed INTEGER NOT NULL REFERENCES locations(id)
);



