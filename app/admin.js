const express = require('express');
const axios = require('axios');

const Keyv = require('keyv');
const db = new Keyv(process.env.KEYV_URI);

const router = express.Router();

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    
    req.session.returnTo = req.originalUrl;
    res.redirect('/');
}

router.get('/admin', ensureAuthenticated, async (req, res) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return res.redirect('/login/auth0');
    if(await db.get('admin-' + req.user.emails[0].value) == true) {
        res.render('admin', {
            user: req.user, // User info
            coins: await db.get('coins-' + req.user.emails[0].value), // User's coins
            req: req, // Request (queries)
            admin: await db.get('admin-' + req.user.emails[0].value), // Admin status
            name: process.env.APP_NAME, // App name
        });
    } else {
        res.redirect('/dashboard');
    }
});

router.get('/addcoins', ensureAuthenticated, async (req, res) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return res.redirect('/login/auth0');
    if(await db.get('admin-' + req.user.emails[0].value) == true) {
        if(req.query.email == undefined || req.query.amount == undefined) return res.redirect('/admin?err=INVALIDPARAMS');
        let amount = parseInt((await db.get(`coins-${req.query.email}`))) + parseInt(req.query.amount);
        await db.set(`coins-${req.query.email}`, amount)
        res.redirect('/admin?success=COMPLETE');
    } else {
        res.redirect('/dashboard');
    }
});

router.get('/setcoins', ensureAuthenticated, async (req, res) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return res.redirect('/login/auth0');
    if(await db.get('admin-' + req.user.emails[0].value) == true) {
        if(req.query.email == undefined || req.query.amount == undefined) return res.redirect('/admin?err=INVALIDPARAMS');
        let amount = parseInt(req.query.amount);
        await db.set(`coins-${req.query.email}`, amount)
        res.redirect('/admin?success=COMPLETE');
    } else {
        res.redirect('/dashboard');
    }
});

module.exports = router;