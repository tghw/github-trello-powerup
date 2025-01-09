const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { engine } = require('express-handlebars');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.engine('hbs', engine({ extname: '.hbs', defaultLayout: "", layoutsDir: "" }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'html'));


const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  console.log(CLIENT_ID, CLIENT_SECRET)
  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    },
    {
      headers: { Accept: 'application/json' },
    }
  );
  const token = response.data.access_token;
  console.log("Token", token)
  console.log("Data", response.data)
  
  res.render('callback', { token: token });
});

// Proxy GitHub API requests
app.get('/github/:repo/:type', async (req, res) => {
  const { repo, type } = req.params;
  const token = req.headers.authorization;

  let url;
  switch (type) {
    case 'pulls':
      url = `https://api.github.com/repos/${repo}/pulls`;
      break;
    case 'issues':
      url = `https://api.github.com/repos/${repo}/issues`;
      break;
    case 'branches':
      url = `https://api.github.com/repos/${repo}/branches`;
      break;
    case 'commits':
      url = `https://api.github.com/repos/${repo}/commits`;
      break;
    default:
      res.status(400).send('Invalid type');
      return;
  }

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  res.json(response.data);
});

app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'html/home.html'));
});

app.get('/settings', async (req, res) => {
  res.sendFile(path.join(__dirname, 'html/settings.html'));
});

app.get('/authorize', async (req, res) => {
  res.render('authorize', { githubClientId: CLIENT_ID });
});

app.get('/attachment', async (req, res) => {
  res.sendFile(path.join(__dirname, 'html/attachment.html'));
});

app.listen(process.env.PORT, () => console.log('Server started'));
