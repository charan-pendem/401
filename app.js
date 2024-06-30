const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Function to fetch motorcycle details from API
async function fetchMotorcycleDetails(make, model) {
  const apiKey = 'fHZIenVoYf6D1e6S+rxBiw==kSEkF2EOIuKLVbtw'; // Updated API key
  const apiEndpoint = `https://api.api-ninjas.com/v1/motorcycles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`; // Updated API endpoint

  try {
    const response = await axios.get(apiEndpoint, {
      headers: {
        'X-Api-Key': apiKey
      }
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      const errorMessage = error.response.data.message || 'Bad Request';
      throw new Error(`API Error: ${error.response.status} - ${errorMessage}`);
    } else if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error('No response received from API');
    } else {
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
}

// Register endpoint
app.get('/register', (req, res) => {
  res.render('register', { errorMessage: null });
});

app.post('/register', async (req, res) => {
  const { username, email, phoneNumber, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render('register', { errorMessage: 'Passwords do not match' });
  }

  if (!/^\d{10}$/.test(phoneNumber)) {
    return res.render('register', { errorMessage: 'Phone number must be 10 digits' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.render('register', { errorMessage: 'Invalid email format' });
  }

  try {
    const snapshot = await db.collection('users').where('email', '==', email).get();
    if (!snapshot.empty) {
      return res.render('register', { errorMessage: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection('users').doc(email).set({
      username,
      email,
      phoneNumber,
      password: hashedPassword,
    });

    res.redirect('/login');
  } catch (err) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

// Login endpoint
app.get('/login', (req, res) => {
  res.render('login', { errorMessage: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userDoc = await db.collection('users').doc(email).get();
    if (!userDoc.exists) {
      return res.render('login', { errorMessage: 'Incorrect email or password' });
    }

    const user = userDoc.data();
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.redirect('/motorcycleResults');
    } else {
      return res.render('login', { errorMessage: 'Incorrect email or password' });
    }
  } catch (err) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

// Motorcycle results endpoint
app.get('/motorcycleResults', (req, res) => {
  res.render('motorcycleResults', { make: '', model: '', motorcycles: null });
});

app.get('/motorcycles', async (req, res) => {
  const { make, model } = req.query;

  try {
    const motorcycles = await fetchMotorcycleDetails(make, model);
    res.render('motorcycleResults', { make, model, motorcycles });
  } catch (error) {
    res.status(500).send('Server Error: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
  