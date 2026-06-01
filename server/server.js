// Servidor Express básico con endpoints para guardar/leer/borrar registros
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// Obtener todos los registros
app.get('/api/entries', (req, res) => {
  db.all('SELECT * FROM entries ORDER BY date DESC', [], (err, rows) => {
    if(err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

// Insertar un registro
app.post('/api/entries', (req, res) => {
  const { id, date, type, category, amount, description } = req.body;
  const stmt = db.prepare('INSERT INTO entries (id,date,type,category,amount,description) VALUES (?,?,?,?,?,?)');
  stmt.run(id, date, type, category, amount, description, function(err){
    if(err) return res.status(500).json({error: err.message});
    res.status(201).json({id});
  });
});

// Eliminar por id
app.delete('/api/entries/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare('DELETE FROM entries WHERE id = ?');
  stmt.run(id, function(err){
    if(err) return res.status(500).json({error: err.message});
    res.json({deleted: this.changes});
  });
});

app.listen(PORT, ()=> console.log(`Finance API running on http://localhost:${PORT}`));
