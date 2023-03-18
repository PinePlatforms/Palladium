const express = require('express');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const Keyv = require('keyv');
const db = new Keyv(process.env.KEYV_URI);

var randomstring = require("randomstring");

const pterodactyl = [{
  "url": process.env.PTERODACTYL_URL, 
  "key": process.env.PTERODACTYL_KEY
}]

const router = express.Router();

// Configure passport to use Auth0
const auth0Strategy = new Auth0Strategy({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  callbackURL: process.env.AUTH0_CALLBACK_URL
}, (accessToken, refreshToken, extraParams, profile, done) => {
  return done(null, profile);
});

// Pterodactyl account system
async function checkAccount(email) {
    try {
      // Check if user has an account
      const response = await axios.get(`${pterodactyl[0].url}/api/application/users?filter[email]=${email}`, {
        headers: {
          'Authorization': `Bearer ${pterodactyl[0].key}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      });
      // If yes, do nothing
      if (response.data.data.length > 0) {
        return;
      }
      // If not, create one
      let password = randomstring.generate(process.env.PASSWORD_LENGTH);
      await axios.post(`${pterodactyl[0].url}/api/application/users`, {
        'email': email,
        'username': email.split('@')[0],
        "first_name": 'Palladium User',
        "last_name": 'Palladium User',
        'password': password
      }, {
        headers: {
          'Authorization': `Bearer ${pterodactyl[0].key}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      });

      // Fetch the user's ID
      const fetchId = await axios.get(`${pterodactyl[0].url}/api/application/users?filter[email]=${email}`, {
        headers: {
          'Authorization': `Bearer ${pterodactyl[0].key}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      });
      const userId = fetchId.data.data[0].attributes.id;
      db.set('id-' + email, userId);

      fs.appendFile(process.env.LOGS_PATH, '[LOG] User object created.' + '\n', function (err) {
        if (err) console.log('Failed to save log: ' + err);
      });
      
      // Set password & log to console
      db.set('password-' + email, password);
    } catch (error) {
      fs.appendFile(process.env.LOGS_ERROR_PATH, '[LOG] Failed to check user information. The panel did not respond correctly.' + '\n', function (err) {
        if (err) console.log('Failed to save log: ' + err);
      });
    }
  }

passport.use(auth0Strategy);

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Set up Auth0 routes
router.get('/login/auth0', passport.authenticate('auth0', {
  scope: 'openid email profile'
}), (req, res) => {
  res.redirect('/');
});

router.get('/callback/auth0', passport.authenticate('auth0', {
  failureRedirect: '/login'
}), (req, res) => {
  checkAccount(req.user.emails[0].value);
  res.redirect(req.session.returnTo || '/dashboard');
});

// Reset password of the user via Pterodactyl API
router.get('/reset', async (req, res) => {
    if (!req.user) return res.redirect('/')
    try {
      // Generate new password
      let password = randomstring.generate(process.env.PASSWORD_LENGTH);
  
      // Update user password in Pterodactyl
      const userId = await db.get('id-' + req.user.emails[0].value);
      await axios.patch(`${pterodactyl[0].url}/api/application/users/${userId}`, {
        email: req.user.emails[0].value,
        username: req.user.emails[0].value.split('@')[0],
        first_name: 'Palladium User',
        last_name: 'Palladium User',
        language: "en",
        password: password
      }, {
        headers: {
          'Authorization': `Bearer ${pterodactyl[0].key}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      });
  
      // Update password in database
      db.set('password-' + req.user.emails[0].value, password)
      fs.appendFile(process.env.LOGS_PATH, '[LOG] Password resetted for user.' + '\n', function (err) {
        if (err) console.log('Failed to save log: ' + err);
      });
  
      // Load credentials page
      res.redirect('/credentials');

    } catch (error) {
      // Handle error
      fs.appendFile(process.env.LOGS_ERROR_PATH, '[LOG] Failed to reset password for a user. The panel did not respond correctly.' + '\n', function (err) {
        if (err) console.log('Failed to save log: ' + err);
      });

      res.status(500).send({
        success: false,
        message: 'Error resetting password'
      });
    }
  });

// Set up logout route
router.get('/logout', (req, res) => {
  const returnTo = process.env.APP_URL;

  // Construct logout URL
  const logoutURL = `https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${returnTo}`;

  // Log the user out from Auth0 and redirect to homepage
  res.redirect(logoutURL);
});

module.exports = router;