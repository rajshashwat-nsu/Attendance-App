const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Directories
const CLASS_DIR = path.join(__dirname, 'data');      // Only class Excel files
const USER_FILE = path.join(__dirname, 'private', 'users.xlsx'); // Moved

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory session storage
let userSessions = {};  // Format: { username: { batches: ['class1', 'class2'] } }

// ✅ LOGIN ROUTE
app.post('/api/login', (req, res) => {
  if (!fs.existsSync(USER_FILE)) return res.status(404).send('User file not found');

  const workbook = XLSX.readFile(USER_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const users = XLSX.utils.sheet_to_json(sheet);

  const { username, password } = req.body;
  const match = users.find(u =>
    u.username?.trim().toLowerCase() === username.trim().toLowerCase() &&
    u.password?.trim() === password.trim()
  );

  if (match) {
    const batches = (match.batches || '')
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);

    userSessions[username] = { batches };

    res.status(200).json({ username });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// 🧾 Filter classes based on logged-in user
app.get('/api/classes', (req, res) => {
  const username = req.query.username;
  if (!userSessions[username]) return res.status(403).send('Unauthorized');

  const userBatches = userSessions[username].batches;
  const availableFiles = fs.readdirSync(CLASS_DIR)
    .filter(file => file.endsWith('.xlsx'))
    .map(file => file.replace('.xlsx', ''));

  const filtered = availableFiles.filter(f => userBatches.includes(f));
  res.json(filtered);
});

// 📄 Load student data
app.get('/api/class/:name', (req, res) => {
  const filePath = path.join(CLASS_DIR, req.params.name + '.xlsx');
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  res.json({ sheetName, data });
});

// 💾 Save attendance
app.post('/api/class/:name/save', (req, res) => {
  const { sheetName, data } = req.body;
  const filePath = path.join(CLASS_DIR, req.params.name + '.xlsx');

  const newSheet = XLSX.utils.json_to_sheet(data);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
  XLSX.writeFile(newWorkbook, filePath);

  res.send('Attendance saved.');
});

app.get('/api/student/:rollno', (req, res) => {
  const rollno = req.params.rollno?.trim();
  const dataDir = path.join(__dirname, 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const match = rows.find(r => String(r.rollno).trim() === rollno);

    if (match) {
      return res.json({
        ...match,
        batch: file.replace('.xlsx', '')
      });
    }
  }

  res.status(404).send('Student not found');
});

app.get('/api/class/:name', (req, res) => {
  const className = req.params.name;
  const filePath = path.join(__dirname, 'data', className + '.xlsx');
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  res.json({ sheetName, data });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
