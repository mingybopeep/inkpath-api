require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const moment = require('moment');

const app = express();
app.use(express.json());
app.use(cors());

const authenticateToken = (req, res, next) => {
    const { token } = req.headers; //extract the token from the header
    if (!token) { 
        return res.status(401).send(`You haven't provided a token`); //no token = fail 
    } else {
        jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
            if (err) {//token is no good
                return res.status(403).send(`Your token isn't valid`); //fail req
            } else { // token works
                req.user = user; //jwt corresponds to user
                next(); //continue
            }
        });
    }
}

//check base and quote are provided
const checkParams = (req, res, next) => {
    let { query } = req;
    if (!query.quote) {
        return res.status(400).send('Parameters missing');
    } else {
        next();
    }
}

//getting a token endpoint
app.post('/token', (req, res) => {
    const { username } = req.body;
    const user = { username };
    const token = jwt.sign(user, process.env.TOKEN_SECRET); //serialise the provided username 
    res.json({ token }); // send it back
});

//range of dates route
app.get('/range', [authenticateToken, checkParams], async (req, res) => {
    let { quote, start, end } = req.query;
    if (start && end) {
        let promises = [];
        end = moment(end, 'YYYY-MM-DD').toDate();
        let current = moment(start, 'YYYY-MM-DD');

        while (current.toDate() < end) {
            //check if weekday
            if (current.toDate().getDay() != 0 && current.toDate().getDay() != 6) {
                let date = current.format('YYYY-MM-DD');
                let url = `http://api.exchangeratesapi.io/v1/${date}?access_key=${process.env.FX_KEY}&symbols=${quote}`;
                promises.push(axios.get(url));
            };
            current = current.add(1, 'day');
        };

        let results = await Promise.all(promises);

        results = results.map(result => {
            return {
                symbol: `EUR/${quote}`,
                rate: result.data.rates[quote],
                date: result.data.date
            }
        });

        if (results) {
            res.json(results);
        }

    } else {
        res.status(400).send('Parameters missing');
    }
})

//converting route
app.get('/convert', [authenticateToken, checkParams], async (req, res) => {
    let { quote, amount } = req.query;
    if (amount) {
        let url = `http://api.exchangeratesapi.io/v1/latest?access_key=${process.env.FX_KEY}&symbols=${quote}`;
        //ask API for data
        const { data } = await axios.get(url)
            .catch(err => res.status('400').send('Something went wrong'));
        if (data) {
            res.json([{
                symbol: `EUR/${quote}`,
                rate: data.rates[quote],
                date: data.date,
                equals: (amount * data.rates[quote]).toFixed(2)
            }]);
        }
    } else {
        res.status(400).send('Parameters missing');
    }
})

//historical single point endpoint
app.get('/historical', [authenticateToken, checkParams], async (req, res) => {
    let { query } = req;
    if (query.date) {
        let url = `http://api.exchangeratesapi.io/v1/${query.date}?access_key=${process.env.FX_KEY}&symbols=${query.quote}`
        //ask API for data
        const { data } = await axios.get(url)
            .catch(err => res.status('400').send('Something went wrong'));
        // reformatting the data 
        const row = [{
            symbol: `EUR/${query.quote}`,
            date: query.date,
            rate: data.rates[query.quote]
        }];
        res.json(row); //send it back
    } else {
        res.status(400).send('Parameters missing');
    }
});

app.listen(3050, () => {
    console.log('SERVER RUNNING');
});




