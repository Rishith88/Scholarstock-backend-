const JSZip = require('jszip');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Generate Anki .apkg file from flashcard deck
const generateAnkiPackage = async (deckName, cards) => {
  const zip = new JSZip();
  
  // Create collection.anki2 (SQLite database)
  const dbPath = path.join(__dirname, `temp_${Date.now()}.db`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      
      // Create Anki schema
      db.serialize(() => {
        db.run(`CREATE TABLE col (
          id INTEGER PRIMARY KEY,
          crt INTEGER,
          mod INTEGER,
          scm INTEGER,
          ver INTEGER,
          dty INTEGER,
          usn INTEGER,
          ls INTEGER,
          conf TEXT,
          models TEXT,
          decks TEXT,
          dconf TEXT,
          tags TEXT
        )`);
        
        db.run(`CREATE TABLE notes (
          id INTEGER PRIMARY KEY,
          guid TEXT,
          mid INTEGER,
          mod INTEGER,
          usn INTEGER,
          tags TEXT,
          flds TEXT,
          sfld TEXT,
          csum INTEGER,
          flags INTEGER,
          data TEXT
        )`);
        
        db.run(`CREATE TABLE cards (
          id INTEGER PRIMARY KEY,
          nid INTEGER,
          did INTEGER,
          ord INTEGER,
          mod INTEGER,
          usn INTEGER,
          type INTEGER,
          queue INTEGER,
          due INTEGER,
          ivl INTEGER,
          factor INTEGER,
          reps INTEGER,
          lapses INTEGER,
          left INTEGER,
          odue INTEGER,
          odid INTEGER,
          flags INTEGER,
          data TEXT
        )`);
        
        // Insert collection record
        const now = Math.floor(Date.now() / 1000);
        db.run(`INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, -1, 0, '{}', '{}', '{}', '{}', '')`,
          [now, now, now]);
        
        // Insert cards
        cards.forEach((card, idx) => {
          const fields = `${card.front}\x1f${card.back}`;
          db.run(`INSERT INTO notes VALUES (?, ?, 1, ?, -1, '', ?, ?, 0, 0, '')`,
            [idx + 1, `guid-${idx}`, now, fields, card.front]);
          
          db.run(`INSERT INTO cards VALUES (?, ?, 1, 0, ?, -1, 0, 0, ?, 0, 2500, 0, 0, 0, 0, 0, 0, '')`,
            [idx + 1, idx + 1, now, now]);
        });
        
        db.close((err) => {
          if (err) return reject(err);
          
          // Read database and add to zip
          const dbContent = fs.readFileSync(dbPath);
          zip.file('collection.anki2', dbContent);
          zip.file('media', '{}');
          
          // Generate .apkg
          zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
            fs.unlinkSync(dbPath);
            resolve(content);
          }).catch(reject);
        });
      });
    });
  });
};

module.exports = {
  generateAnkiPackage,
};
