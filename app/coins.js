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

let earners = {}

router.ws('/afkws', async (ws, req) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return ws.close();
    if(earners[req.user.emails[0].value] == true) return ws.close();
    let time = 60;
    earners[req.user.emails[0].value] = true;
    let aba = setInterval(async () => {
        if(earners[req.user.emails[0].value] == true) {
            time--;
            if(time <= 0) {
                time = 60;
                ws.send(JSON.stringify({"type":"coin"}))
                let r = parseInt((await db.get(`coins-${req.user.emails[0].value}`))) + 1;
               await db.set(`coins-${req.user.emails[0].value}`,r)
            }
            ws.send(JSON.stringify({"type":"count","amount":time}))
        }
    }, 1000)
    ws.on('close', async () => {
        delete earners[req.user.emails[0].value];
        clearInterval(aba)
    })
});

router.get('/afk', ensureAuthenticated, async (req, res) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return res.redirect('/login/auth0');
    res.render('afk', {
        user: req.user, // User info
        coins: await db.get('coins-' + req.user.emails[0].value), // User's coins
        req: req, // Request (queries)
        admin: await db.get('admin-' + req.user.emails[0].value), // Admin status
        name: process.env.APP_NAME, // App name
    });
});

// Store

router.get('/store', ensureAuthenticated, async (req, res) => {
    if(req.user == undefined || req.user.emails.length < 1 || req.user.emails == undefined) return res.redirect('/login/auth0');
    res.render('store', {
        user: req.user, // User info
        coins: await db.get('coins-' + req.user.emails[0].value), // User's coins
        req: req, // Request (queries)
        admin: await db.get('admin-' + req.user.emails[0].value), // Admin status
        name: process.env.APP_NAME, // App name
    });
});

router.get('/buyresource', ensureAuthenticated, async (req, res) => {
    if (req.query.resource == undefined || req.query.amount == undefined) return res.redirect('/store?err=MISSINGPARAMS');

    // Ensure amount is a number and is below 10
    if (isNaN(req.query.amount) || req.query.amount > 10) return res.redirect('/store?err=INVALIDAMOUNT');

    // Ensure resource is a valid one
    if (req.query.resource != 'cpu' && req.query.resource != 'ram' && req.query.resource != 'disk') return res.redirect('/store?err=INVALIDRESOURCE');

    let coins = await db.get('coins-' + req.user.emails[0].value);
    let currentResources = await db.get(req.query.resource + '-' + req.user.emails[0].value);

    // Resource amounts & costs
    if (req.query.resource == 'cpu') {
        let resourceAmount = 100 * req.query.amount
        let resourceCost = process.env.CPU_COST * req.query.amount
        if (coins < resourceCost) return res.redirect('/store?err=NOTENOUGHCOINS');
        await db.set('cpu-' + req.user.emails[0].value, parseInt(currentResources) + parseInt(resourceAmount));
        await db.set('coins-' + req.user.emails[0].value, parseInt(coins) - parseInt(resourceCost));
        return res.redirect('/store?success=BOUGHTRESOURCE');
    } else if (req.query.resource == 'ram') {
        let resourceAmount = 1024 * req.query.amount
        let resourceCost = process.env.RAM_COST * req.query.amount
        if (coins < resourceCost) return res.redirect('/store?err=NOTENOUGHCOINS');
        await db.set('ram-' + req.user.emails[0].value, parseInt(currentResources) + parseInt(resourceAmount));
        await db.set('coins-' + req.user.emails[0].value, parseInt(coins) - parseInt(resourceCost));
        return res.redirect('/store?success=BOUGHTRESOURCE');
    } else if (req.query.resource == 'disk') {
        let resourceAmount = 5120 * req.query.amount
        let resourceCost = process.env.DISK_COST * req.query.amount
        if (coins < resourceCost) return res.redirect('/store?err=NOTENOUGHCOINS');
        await db.set('disk-' + req.user.emails[0].value, parseInt(currentResources) + parseInt(resourceAmount));
        await db.set('coins-' + req.user.emails[0].value, parseInt(coins) - parseInt(resourceCost));
        return res.redirect('/store?success=BOUGHTRESOURCE');
    }
});

module.exports = router;