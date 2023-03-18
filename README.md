![Palladium](https://cdn.discordapp.com/attachments/1085575983274401912/1086714457843056762/Palladium.png)
![Palladium](https://cdn.discordapp.com/attachments/1056121952051396705/1079723556109303890/image-45.png)

<hr>

# Palladium

All features:
- Resource Management (Use it to create servers, gift them, etc)
- Coins (AFK Page earning)
- Servers (create, view, edit servers)
- User System (auth, regen password, etc)
- OAuth2 (Google, Discord, etc)
- Store (buy resources with coins)
- Dashboard (view resources & servers)
- Admin (set/add/remove coins)

<br>

| :exclamation:  This is an extremely early version of Palladium and doesn't have all of features we want to add yet   |
|----------------------------------------------------------------------------------------------------------------------|
<br>
| :warning:  Palladium currently doesn't encrypt user passwords. This will be fixed in 1.0.1, but for now, just don't leak your database.sqlite.       |
|------------------------------------------------------------------------------------------------------------------------------------------------------|

<hr>

# Install Guide

Warning: You need Pterodactyl already set up on a domain for Heliactyl to work
1. Upload the file above onto a Pterodactyl NodeJS server [Download the egg from Parkervcp's GitHub Repository](https://github.com/parkervcp/eggs/blob/master/generic/nodejs/egg-node-js-generic.json)
2. Unarchive the file and set the server to use NodeJS 16
3. Configure `.env`, `/resources/configuration/locations.ejs` and `/storage/eggs.json`
4. Start the server
5. Login to your DNS manager, point the domain you want your dashboard to be hosted on to your VPS IP address. (Example: dashboard.domain.com 192.168.0.1)
6. Run `apt install nginx && apt install certbot` on the vps
7. Run `ufw allow 80` and `ufw allow 443` on the vps
8. Run `certbot certonly -d <Your Palladium Domain>` then do 1 and put your email
9. Run `nano /etc/nginx/sites-enabled/palladium.conf`
10. Paste the configuration at the bottom of this and replace with the IP of the pterodactyl server including the port and with the domain you want your dashboard to be hosted on.
11. Run `systemctl restart nginx` and try open your domain.

# Nginx Proxy Config
```Nginx
server {
    listen 80;
    server_name <domain>;
    return 301 https://$server_name$request_uri;
}
server {
    listen 443 ssl http2;
location /afkwspath {
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_pass "http://localhost:<port>/afkwspath";
}
    
    server_name <domain>;
ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
location / {
      proxy_pass http://localhost:<port>/;
      proxy_buffering off;
      proxy_set_header X-Real-IP $remote_addr;
  }
}
```


