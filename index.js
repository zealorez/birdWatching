/* eslint-disable no-useless-return */
import express from 'express';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import moment from 'moment';
import jsSHA from 'jssha';

const SALT = 'banana';
const PORT = process.argv[2];

let pgConnectionConfigs;

if (process.env.ENV === 'PRODUCTION') {
  pgConnectionConfigs = {
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
} else {
  pgConnectionConfigs = {
    user: 'zephaniahong',
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
}

const { Pool } = pg;
const pool = new Pool(pgConnectionConfigs);
pool.connect();

const app = express();
app.set('view engine', 'ejs');
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// renders home page
app.get('/', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${userId}-${SALT}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  if (hashedCookieString !== loggedInHash) {
    res.render('login', { loggedInHash: undefined });
    return;
  }
  pool.query('SELECT species.id, notes.id,species.name, species.scientific_name, notes.habitat, notes.date, notes.appearance, notes.vocalisations, notes.flock_size from notes INNER JOIN species ON species.id = notes.species_id', (err, result) => {
    if (err) {
      console.error('query error', err.stack);
      res.status(503);
      return;
    }
    const data = result.rows;
    const species = [];
    // array to check if species has already been appended
    const speciesDone = [];
    data.forEach((element) => {
      if (!speciesDone.includes(element.name)) {
        speciesDone.push(element.name);
        species.push({ name: element.name, id: element.id });
      }
    });
    res.render('all', {
      data, species, loggedInHash,
    });
  });
});

// renders a form for user to submit a note
app.get('/note', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  pool.query('SELECT * FROM species', (queryError, queryResult) => {
    if (queryError) {
      console.error('Query Error', queryError.stack);
      res.status(503);
      return;
    }
    const species = queryResult.rows;
    pool.query('SELECT * FROM behaviours', (queryError2, queryResult2) => {
      if (queryError2) {
        console.error('Query Error', queryError2.stack);
        res.status(503);
        return;
      }
      const behaviours = queryResult2.rows;
      res.render('note', { species, behaviours, loggedInHash });
    });
  });
});

// species form
app.get('/species', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  res.render('species', { loggedInHash });
});

// renders a single note
app.get('/note/:id', (req, res) => {
  const { id } = req.params;
  const { loggedInHash, userId } = req.cookies;

  const whenDoneWithQuery = (err, result) => {
    if (err) {
      console.error('query error', err.stack);
    }
    const data = result.rows[0];
    pool.query(`SELECT * FROM behaviours INNER JOIN notes_behaviour ON behaviours.id = notes_behaviour.behaviour_id WHERE notes_behaviour.notes_id = ${id}`, (err2, result2) => {
      if (err2) {
        console.error('query2 error', err2.stack);
      }
      const behaviours = result2.rows;
      pool.query(`SELECT * FROM comments WHERE note_id = ${id}`, (err3, result3) => {
        if (err3) {
          console.error('query 3 error', err3);
          return;
        }
        const comments = result3.rows;
        res.render('singleNote', {
          data, loggedInHash, behaviours, comments,
        });
      });
    });
  };

  pool.query(`SELECT * FROM notes WHERE id=${id}`, whenDoneWithQuery);
});

// render sign up page
app.get('/signup', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  res.render('signup', { loggedInHash });
});

// login page
app.get('/login', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  res.render('login', { loggedInHash });
});

app.get('/species/:id', (req, res) => {
  const { loggedInHash, userId } = req.cookies;
  const { id } = req.params;
  pool.query(`SELECT species.id, notes.id AS noteId, species.name, species.scientific_name, notes.habitat, notes.date, notes.appearance, notes.vocalisations, notes.flock_size from notes INNER JOIN species ON species.id = notes.species_id WHERE species_id=${id}`, (err, result) => {
    if (err) {
      console.error('query error', err.stack);
      res.status(503);
      return;
    }
    const data = result.rows;
    res.render('singleSpecies', { data, loggedInHash });
  });
});

app.get('/note/:id/edit', (req, res) => {
  const { id } = req.params;
  const { loggedInHash, userId } = req.cookies;

  const whenDoneWithQuery = (err, result) => {
    if (err) {
      console.error('query error', err.stack);
    }
    const data = result.rows[0];
    pool.query('SELECT * FROM behaviours', (err2, result2) => {
      if (err2) {
        console.error('query2 error', err2.stack);
      }
      const behaviours = result2.rows;

      pool.query('SELECT * FROM species', (err3, result3) => {
        if (err3) {
          console.error('query3 error', err3);
          return;
        }
        const species = result3.rows;
        pool.query(`SELECT * FROM behaviours INNER JOIN notes_behaviour ON behaviours.id = notes_behaviour.behaviour_id WHERE notes_behaviour.notes_id = ${id}`, (err4, result4) => {
          if (err4) {
            console.error('query 4 error', err4);
            return;
          }
          const noteBehaviour = result4.rows;
          const behaviourArray = [];
          noteBehaviour.forEach((element) => {
            behaviourArray.push(element.behaviour_id);
          });
          res.render('edit', {
            data, loggedInHash, behaviours, species, moment, noteBehaviour, behaviourArray,
          });
        });
      });
    });
  };
  pool.query(`SELECT * FROM notes WHERE id=${id}`, whenDoneWithQuery);
});

// note with comment box
app.get('/note/:id/comment', (req, res) => {
  const { id } = req.params;
  const { loggedInHash, userId } = req.cookies;

  const whenDoneWithQuery = (err, result) => {
    if (err) {
      console.error('query error', err.stack);
    }
    const data = result.rows[0];
    pool.query(`SELECT * FROM behaviours INNER JOIN notes_behaviour ON behaviours.id = notes_behaviour.behaviour_id WHERE notes_behaviour.notes_id = ${id}`, (err2, result2) => {
      if (err2) {
        console.error('query2 error', err2.stack);
      }
      const behaviours = result2.rows;
      pool.query(`SELECT * FROM comments WHERE note_id = ${id}`, (err3, result3) => {
        if (err3) {
          console.error('query 3 error', err3);
          return;
        }
        const comments = result3.rows;
        res.render('comments', {
          data, loggedInHash, behaviours, comments,
        });
      });
    });
  };

  pool.query(`SELECT * FROM notes WHERE id=${id}`, whenDoneWithQuery);
});

app.post('/note/:id/comment', (req, res) => {
  const { userId } = req.cookies;
  const { id } = req.params;
  const { comment } = req.body;
  pool.query('INSERT INTO comments (content, user_id, note_id) VALUES ($1, $2, $3)', [comment, userId, id], (err, result) => {
    if (err) {
      console.error('query error', err);
      return;
    }
    res.redirect(`/note/${id}`);
  });
});

// insert new species into database
app.post('/species', (req, res) => {
  const inputData = [req.body.name, req.body.scientific_name];
  console.log(inputData);
  pool.query('INSERT INTO species (name, scientific_name) VALUES ($1, $2)', inputData, (err, result) => {
    if (err) {
      console.error('query error', err.stack);
      return;
    }
  });
  res.redirect('/');
});

// user authentication
app.post('/login', (req, res) => {
  const email = [req.body.email];
  pool.query('SELECT * FROM users WHERE email=$1', email, (err, queryResult) => {
    if (err) {
      console.error('Query Error', error.stack);
      res.status(503);
      return;
    }
    if (queryResult.rows.length === 0) {
      res.status(503).send('sorry');
      return;
    }

    const user = queryResult.rows[0];
    const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
    shaObj.update(req.body.password);
    const hashedPasswordInput = shaObj.getHash('HEX');
    if (user.password !== hashedPasswordInput) {
      res.send('login failed');
      return;
    }
    const shaObj2 = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
    const unhashedCookieString = `${user.id}-${SALT}`;
    shaObj2.update(unhashedCookieString);
    const hashedCookieString = shaObj2.getHash('HEX');
    res.cookie('loggedInHash', hashedCookieString);
    res.cookie('userId', user.id);
    res.redirect('/');
  });
});

// user registration
app.post('/signup', (req, res) => {
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  shaObj.update(req.body.password);
  const hashedPassword = shaObj.getHash('HEX');
  const { email } = req.body;
  const userInput = [email, hashedPassword];
  const query = 'INSERT INTO users (email, password) VALUES ($1, $2)';
  const whenDoneWithQuery = (err, result) => {
    if (err) {
      console.log('query error', err.stack);
    }
    res.redirect('login');
  };
  pool.query(query, userInput, whenDoneWithQuery);
});

// insert form data in table after user clicks submit
app.post('/note', (req, res) => {
  const userInput = req.body;
  console.log(userInput);
  const keys = Object.keys(userInput);
  const queryArray = [];
  // exclude behaviour from array
  for (let i = 0; i < keys.length - 1; i += 1) {
    queryArray.push(userInput[keys[i]]);
  }
  pool.query('INSERT INTO notes (habitat, species_id, date, appearance, flock_size, vocalisations) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', queryArray, (err, result) => {
    if (err) {
      console.error('query error', err.stack);
      return;
    }
    const speciesId = userInput.species;
    const behaviourIds = userInput.behaviour;
    let queryCounter = 0;
    behaviourIds.forEach((element) => {
      const inputData = [speciesId, element];
      pool.query('INSERT INTO notes_behaviour (notes_id, behaviour_id) VALUES ($1,$2) RETURNING *', inputData, (err2, result2) => {
        if (err) {
          console.error('2nd query error', err2);
          return;
        }
        queryCounter += 1;
        if (queryCounter === behaviourIds.length) {
          res.redirect('/');
        }
      });
    });
  });
});

app.put('/note/:id/edit', (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const dataArray = [...Object.values(data)];
  pool.query(`UPDATE notes SET habitat='${dataArray[0]}', species_id='${dataArray[1]}', date='${dataArray[2]}', appearance='${dataArray[3]}', flock_size='${dataArray[4]}', vocalisations='${dataArray[5]}' WHERE notes.id = ${id}`, (err, result) => {
    if (err) {
      console.error('query error', err);
      return;
    }
  });
});

app.delete('/note/:id', (req, res) => {
  const { id } = req.params;
  pool.query(`DELETE FROM notes WHERE notes.id = ${id}`, (err, result) => {
    if (err) {
      console.error('query error', err.stack);
      return;
    }
    pool.query(`DELETE FROM notes_behaviour WHERE notes_behaviour.notes_id = ${id}`, (err2, result2) => {
      if (err2) {
        console.error('query error', err2.stack);
        return;
      }
      res.redirect('/');
    });
  });
});

app.delete('/logout', (req, res) => {
  res.clearCookie('userId');
  res.clearCookie('loggedInHash');
  res.redirect('login');
});

app.listen(PORT, () => {
  console.log('listening on PORT', PORT);
});
