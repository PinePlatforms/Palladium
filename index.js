const express = require('express');
const session = require('express-session');
const fs = require('fs');
const passport = require('passport');
const ejs = require('ejs');
const path = require('path');

require('dotenv').config();

const app = express();
const expressWs = require('express-ws')(app);

const Keyv = require('keyv');
const db = new Keyv(process.env.KEYV_URI);

// Add admin users
let admins = process.env.ADMIN_USERS.split(',');
for(let i = 0; i < admins.length; i++) {
  db.set('admin-' + admins[i], true);
}

// Set up ejs as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/resources'));

// Set up session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Require the routes

let allRoutes = fs.readdirSync("./app");
for(let i = 0; i < allRoutes.length; i++) {
  let route = require(`./app/${allRoutes[i]}`);
  expressWs.applyTo(route)
  app.use("/", route);
}

// Start the server
app.listen(process.env.APP_PORT || 3000, () => {
  console.log(`Palladium has been started on port ${process.env.APP_PORT || 3000}!`);
});
