const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = 9000

app.use(bodyParser.json());

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });

app.post("/hook", (req, res) => {
    console.log(req.body) // Call your action on the request here
    res.status(200).end() // Responding is important
  })

