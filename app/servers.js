const express = require('express');
const axios = require('axios');

const fs = require('fs');

const Keyv = require('keyv');
const db = new Keyv(process.env.KEYV_URI);

const router = express.Router();

// Resources

const pterodactyl = [{
  "url": process.env.PTERODACTYL_URL, 
  "key": process.env.PTERODACTYL_KEY
}]

// Figure out how what the user's total resource usage is right now
async function calculateResource(email, resource) {
    try {
      // Get user's servers
      const response = await axios.get(`${pterodactyl[0].url}/api/application/users?include=servers&filter[email]=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${pterodactyl[0].key}`,
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      });
  
      // Sum total resources in use
      let totalResources = 0;
      response.data.data[0].attributes.relationships.servers.data.forEach(server => {
        totalResources += server.attributes.limits[resource];
      });
  
      return totalResources;
    } catch (error) {
      fs.appendFile(process.env.LOGS_ERROR_PATH, '[LOG] Failed to calculate resources of all servers combined.' + '\n', function (err) {
        if (err) console.log('Failed to save log: ' + err);
      });
    }
  }

  // Existing resources (the ones in use on servers)
  const existingResources = async (email) => {
    return {
      "cpu": await calculateResource(email, 'cpu'),
      "ram": await calculateResource(email, 'memory'),
      "disk": await calculateResource(email, 'disk')
    };
  };
  
  // Max resources (the ones the user has purchased or been given)
  const maxResources = async (email) => {
    return {
      "cpu": await db.get('cpu-' + email),
      "ram": await db.get('ram-' + email),
      "disk": await db.get('disk-' + email)
    };
  };

// Decided not to use pterodactyl.* here

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    
    req.session.returnTo = req.originalUrl;
    res.redirect('/');
  }

// Delete server
router.get('/delete', ensureAuthenticated, async (req, res) => {
    if (!req.query.id) return res.redirect('../dashboard?err=MISSINGPARAMS');
    try {
        const userId = await db.get('id-' + req.user.emails[0].value);
        const serverId = req.query.id;

        const server = await axios.get(`${process.env.PTERODACTYL_URL}/api/application/servers/${serverId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PTERODACTYL_KEY}`,
                'Accept': 'application/json'
            }
        });

        if (server.data.attributes.user !== userId) {
            return res.redirect('../dashboard?err=DONOTOWN');
        }

        await axios.delete(`${process.env.PTERODACTYL_URL}/api/application/servers/${serverId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PTERODACTYL_KEY}`,
                'Accept': 'application/json'
            }
        });

        res.redirect('/dashboard');
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.redirect('../dashboard?err=NOTFOUND');
        }

        console.error(error);
        res.redirect('../dashboard?err=INTERNALERROR')
    }
});

// Create server

router.get('/create', ensureAuthenticated, async (req, res) => {
    if (!req.query.name || !req.query.location || !req.query.egg || !req.query.cpu || !req.query.ram || !req.query.disk) return res.redirect('../create-server?err=MISSINGPARAMS');

    // Check if user has enough resources to create a server

    const max = await maxResources(req.user.emails[0].value);
    const existing = await existingResources(req.user.emails[0].value);

    if (parseInt(req.query.cpu) > parseInt(max.cpu - existing.cpu)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');
    if (parseInt(req.query.ram) > parseInt(max.ram - existing.ram)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');
    if (parseInt(req.query.disk) > parseInt(max.disk - existing.disk)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');

    // Ensure resources are above 128MB / 10%

    if (parseInt(req.query.ram) < 128) return res.redirect('../create-server?err=INVALID');
    if (parseInt(req.query.cpu) < 10) return res.redirect('../create-server?err=INVALID');
    if (parseInt(req.query.disk) < 128) return res.redirect('../create-server?err=INVALID');

    // Name checks

    if (req.query.name.length > 100) return res.redirect('../create-server?err=INVALID');
    if (req.query.name.length < 3) return res.redirect('../create-server?err=INVALID');

    // Make sure locations, eggs, resources are numbers

    if (isNaN(req.query.location) || isNaN(req.query.egg) || isNaN(req.query.cpu) || isNaN(req.query.ram) || isNaN(req.query.disk)) return res.redirect('../create-server?err=INVALID');
    if (req.query.cpu < 1 || req.query.ram < 1 || req.query.disk < 1) return res.redirect('../create-server?err=INVALID');

    try {
        const userId = await db.get('id-' + req.user.emails[0].value);
        const name = req.query.name;
        const location = parseInt(req.query.location);
        const eggId = parseInt(req.query.egg);
        const cpu = parseInt(req.query.cpu);
        const ram = parseInt(req.query.ram);
        const disk = parseInt(req.query.disk);
        
        const eggs = require('../storage/eggs.json');

        const egg = eggs.find(e => e.id == eggId);
        const dockerImage = egg.docker_image;
        const startupCommand = egg.startup;
        const environment = egg.settings;

        await axios.post(process.env.PTERODACTYL_URL + "/api/application/servers", {
          "name": name,
          "user": userId,
          environment: environment,
          egg: eggId,
          docker_image: dockerImage,
          startup: startupCommand,
          limits: {
            memory: ram,
            swap: -1,
            disk: disk,
            io: 500,
            cpu: cpu
          },
          feature_limits: {
            databases: 1,
            backups: 1
          },
          deploy: {
            locations: [location],
            dedicated_ip: false,
            port_range: []
          }
        }, {
        headers: {
          'Authorization': 'Bearer ' + process.env.PTERODACTYL_KEY
        }});

        res.redirect('../dashboard?success=CREATED');
    } catch (error) {
        console.error(error);
        res.redirect('../create-server?err=ERRORONCREATE');
    }
});

router.get('/create-server', ensureAuthenticated, async (req, res) => {
    res.render('create', {
      req: req, // Requests (queries) 
      name: process.env.APP_NAME, // Dashboard name
      user: req.user, // User info (if logged in)
      admin: await db.get('admin-' + req.user.emails[0].value), // Admin status
      coins: await db.get('coins-' + req.user.emails[0].value), // Coins,
      locations: require('../storage/locations.json'), // Locations
      locationids: require('../storage/locationids.json'), // Location data
      eggs: require('../storage/eggs.json')
    });
  });

module.exports = router;
