const express = require('express');
const path = require('path');
require('dotenv').config();

// Try to load supabase client safely
let supabase = null;
try {
    supabase = require('./supabase');
} catch (err) {
    console.warn('Could not initialize Supabase client:', err.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: check DB connection and pass status to all views
app.use(async (req, res, next) => {
    // Default values — always set before anything can fail
    res.locals.dbStatus = 'Non connesso';
    const now = new Date();
    res.locals.dbTimestamp = now.toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Only attempt DB check if supabase client is available and configured
    if (supabase && process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('YOUR_')) {
        try {
            const { error } = await supabase.from('_dummy_check').select('*').limit(1);
            // Even if the table doesn't exist, a proper error response from Supabase
            // means the connection itself is working.
            if (!error || error.message.includes('does not exist') || error.message.includes('permission denied') || error.message.includes('relation')) {
                res.locals.dbStatus = 'Connesso';
            }
        } catch (err) {
            // dbStatus stays 'Non connesso'
        }
    }
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.get('/prodotti', (req, res) => {
    res.render('prodotti', { title: 'Prodotti' });
});

app.get('/account', (req, res) => {
    res.render('account', { title: 'Account' });
});

app.get('/chi-siamo', (req, res) => {
    res.render('chi-siamo', { title: 'Chi siamo' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
