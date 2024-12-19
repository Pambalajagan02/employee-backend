const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt=require("bcrypt")
const jscookie=require('js-cookie')
const multer = require('multer');
app.use(express.json())
app.use(express.urlencoded({ extended: true })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const fs = require('fs');


// Directory path
const indexPath = path.join(__dirname, '../employeemanagement/build', 'index.html');

if (fs.existsSync(indexPath)) {
  console.log("index.html found at:", indexPath);
} else {
  console.error("index.html not found at:", indexPath);
}
// Check if the 'uploads' directory exists





app.use(cors());
const dbPath = path.join(__dirname, "./database/managment.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    db.run(`CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
      )`);

      await ensureAdminUser()

    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
    
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
const ensureAdminUser = async () => {
    console.log("insert---------------------")
    const username = 'jaganPambala';  // Admin's email
    const plainPassword = 'jagan@1234';   // Password for admin (use a secure one)
    const role = 'admin';
  
    // Check if the admin already exists
    const admin = await db.get('SELECT * FROM user WHERE username  = ?', [username]);
    
    if (!admin) {
      // Hash the password for security
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      await db.run('INSERT INTO user (username , password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
      console.log("Admin account created");
    }
  };

  initializeDBAndServer();


  const authenticate = (request, response, next) => {
    console.log("hey....here in middile")
    let jwttokens
  
    const authheader = request.headers['authorization'] 
    console.log(authheader)
    if (authheader !== undefined) {
      jwttokens = authheader.split(' ')[1]
      console.log(jwttokens)
      if (jwttokens !== undefined) {
        jwt.verify(jwttokens, 'HERE', async (error, payload) => {
          console.log(jwttokens)
          if (error) {
            console.log(`falied:${error}`)
            response.status(401)
            response.send('Invalid JWT Token')
          } else {
            request.username = payload.username
            console.log(payload)
            next()
          }
        })
      } else {
        response.status(401)
        response.send('Invalid JWT Token')
      }
    } else {
      response.status(401)
      response.send('Invalid JWT Token')
    }
  }

  app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  console.log(username)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      console.log("here your token")
      const jwtToken = jwt.sign(payload, 'HERE');
      response.send({ jwtToken,username });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/'); // Save files in 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file to avoid conflicts
  }
});

const upload = multer({ storage: storage });

// File upload route
app.post('/upload', upload.single('image'), (req, res) => {
  console.log(req.file)
  if (req.file) {
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    const fileUrl = `/uploads/${req.file.filename}`; // URL of the uploaded file
    res.json({ success: true,fileUrl }); 
    console.log("its createdv rey!! wow") // Respond with success and file URL
  } else {
    res.status(400).json({ success: false, message: 'File upload failed' });
    console.log("hmmm---failed rey")
  }
});

app.post('/addemployee', authenticate, async (request, response) => {
  const {
    empname,
    empemail,
    empmobileno,
    imageUrl,
    gender,
    designation,
    course,} = request.body
    console.log(request.body)
    const employeequery = `select*from employee where emp_email='${empemail}';`
    const isuserprasent =  await db.run(employeequery)
    console.log(isuserprasent)
    const {stmt}=isuserprasent 
    const {statement}=stmt
    if(statement==undefined){
      const insertingquery= `insert into employee (emp_name,emp_email,designation,course,mobile_number,image_url,gender) values
       ('${empname}','${empemail}','${designation}','${course}','${empmobileno}','${imageUrl}','${gender}');`
       const res=await db.run(insertingquery) 
       response.send("hey employee is created")
       response.status(200)
    }
    else{
      response.status(400)
      response.send("user is already there")
    }
})

app.get('/employee',authenticate, async (req,res)=>{  
  try {
    const queryForEmployees = `SELECT * FROM employee;`;
    const result = await db.all(queryForEmployees);
    console.log(result)
    console.log("-------------------------------------------------------------")
    res.status(200).json(result); ;
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while retrieving employees.");
  }
 
})

app.delete('/employee/del/:id/',authenticate, async(req,res)=>{
  console.log("heyyy")
  const {id}=req.params 
  const deletequry= `delete from employee where emp_id= ${id};`
  await db.run(deletequry)
  res.send("delete success")
})


app.get('/employee/:id/',authenticate, async(req,res)=>{
  console.log("heyy its server in view")
  try{
    console.log("hey view is woerking")
  const {id}=req.params 
  const viewquery= `select * from employee where emp_id=${id};` 
  const result = await db.get(viewquery) 
  if (result) {
    res.status(200).json(result);  // Send the result as JSON
} else {
    res.status(404).send("Employee not found.");
}
  }
  catch(error){
    res.status(500).send("An error occurred while retrieving employees.");

  }
})

app.put('/employee/update/:empid/',authenticate, async(req,res)=>{
  console.log("hey view is woerking")
  const {empid}=req.params 
  console.log(empid)
  const {empname,empemail,empmobileno,designation,gender,course}=
  console.log("heyy its server in view")
  try{
  const viewquery= `update employee set emp_name= '${empname}',emp_email='${empemail}',designation='${designation}',course='${course}',gender='${gender}',mobile_number='${empmobileno}' where emp_id=${empid};`
  const result = await db.run(viewquery)
  if (result) {
    res.send("updated successfuly")
    res.status(200) // Send the result as JSON
} else {
    res.status(404).send("Employee not found.");
}
  }
  catch(error){
    console.log(error)
    res.status(500).send("An error occurred while retrieving employees.");

  }
})


  // Add this to your `initializeDBAndServer` function after connecting to DB

  module.exports = app;
